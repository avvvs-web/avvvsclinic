import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ensureSchema, sql } from './db';
import { CANCEL_CUTOFF_MIN, fmtDate, fmtTime, fmtWhen, rupees, type ConsultInput } from './consult';
import { createEvent, deleteEvent, moveEvent, seal, unseal } from './google';
import { clinicInbox, sendMail } from './mail';
import { HOLD_MINUTES, paymentProvider, providerById, type Paid } from './payments';
import { slotIsFree, type DoctorOnlineRow } from './slots';
import { CLINIC, abs } from './site';

/*
 * Online consultation appointments. Double booking is prevented by the database (a unique index on
 * doctor + start time for live appointments), so the order here is: take the slot, then create the
 * Google event; if Google fails, the slot is given back.
 */

export interface Appointment {
  id: number; ref: string; doctor_id: number; starts_at: string; ends_at: string;
  status: 'pending_payment' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  name: string; phone: string; email: string; age: string; note: string;
  google_event_id: string | null; meet_url: string | null; manage_token_hash: string;
  reminder_sent_at: string | null; payment_status: 'not_required' | 'pending' | 'paid' | 'refunded'; amount_paise: number | null; created_at: string;
  payment_provider: string | null; payment_ref: string | null; payment_order_ref: string | null; hold_token: string | null;
  doctor_name?: string; doctor_slug?: string; doctor_email?: string; doctor_minutes?: number;
}

const hash = (t: string) => createHash('sha256').update(t).digest('hex');
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const norm = (a: Record<string, unknown>): Appointment => ({ ...(a as unknown as Appointment), starts_at: iso(a.starts_at), ends_at: iso(a.ends_at) });

export const manageUrl = (ref: string, token: string) => abs(`/consult/${ref}?t=${token}`);

export async function appointmentByRef(ref: string): Promise<Appointment | undefined> {
  await ensureSchema();
  const r = await sql()`
    SELECT a.*, d.name AS doctor_name, d.slug AS doctor_slug, d.email AS doctor_email, d.online_minutes AS doctor_minutes
    FROM clinic_appointments a JOIN clinic_doctors d ON d.id = a.doctor_id WHERE a.ref = ${ref} LIMIT 1`;
  return r[0] ? norm(r[0]) : undefined;
}

/** The appointment, if the link's token matches (the patient's proof that the booking is theirs). */
export async function appointmentForPatient(ref: string, token: string) {
  const a = await appointmentByRef(ref);
  if (!a || !token) return undefined;
  const want = Buffer.from(a.manage_token_hash, 'hex'), got = Buffer.from(hash(token), 'hex');
  return want.length === got.length && timingSafeEqual(want, got) ? a : undefined;
}

export const canPatientChange = (a: Pick<Appointment, 'status' | 'starts_at'>) =>
  a.status === 'confirmed' && new Date(a.starts_at).getTime() - Date.now() > CANCEL_CUTOFF_MIN * 60_000;

const isUniqueViolation = (e: unknown) => /unique|duplicate|23505/i.test(String((e as { code?: string; message?: string })?.code ?? '') + String((e as Error)?.message ?? ''));

// ---------- booking ----------

export type CreateResult =
  | { ok: true; ref: string; token: string; status: Appointment['status']; /** set when the patient must now pay: what the gateway's checkout needs */ checkout?: Record<string, unknown> }
  | { ok: false; error: 'taken' | 'unavailable' | 'failed' };

export async function createAppointment(doctor: DoctorOnlineRow, input: ConsultInput): Promise<CreateResult> {
  await ensureSchema();
  const start = new Date(input.start), end = new Date(start.getTime() + doctor.online_minutes * 60_000);
  await releaseExpiredHolds();   // a hold nobody paid for must not block the slot (or the unique index)
  if (!(await slotIsFree(doctor, input.start))) return { ok: false, error: 'taken' };

  const pay = paymentProvider();
  const needsPayment = pay.required && !!doctor.online_fee_paise;
  const ref = randomBytes(6).toString('hex'), token = randomBytes(24).toString('base64url');
  const status = needsPayment ? 'pending_payment' : 'confirmed';
  const hold = needsPayment ? new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString() : null;

  try {
    await sql()`INSERT INTO clinic_appointments
      (ref, doctor_id, starts_at, ends_at, status, name, phone, email, age, note, consent_at, manage_token_hash, payment_status, payment_provider, amount_paise, hold_expires_at, hold_token)
      VALUES (${ref}, ${doctor.id}, ${start.toISOString()}, ${end.toISOString()}, ${status}, ${input.name}, ${input.phone}, ${input.email}, ${input.age}, ${input.note},
        now(), ${hash(token)}, ${needsPayment ? 'pending' : 'not_required'}, ${needsPayment ? pay.id : null}, ${doctor.online_fee_paise}, ${hold}, ${needsPayment ? seal(token) : null})`;
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: 'taken' };
    console.error('[consult] could not save the appointment', e);
    return { ok: false, error: 'failed' };
  }

  // with payment switched on, the event and the emails wait for confirmPaid()
  if (needsPayment) {
    try {
      const order = await pay.createOrder({ ref, amountPaise: doctor.online_fee_paise!, name: input.name, email: input.email, phone: input.phone, description: `Online consultation with ${doctor.name}` });
      await sql()`UPDATE clinic_appointments SET payment_order_ref = ${order.orderRef} WHERE ref = ${ref}`;
      // the gateway stops taking the payment a little before the hold runs out
      return { ok: true, ref, token, status, checkout: { ...order.checkout, timeout: (HOLD_MINUTES - 2) * 60 } };
    } catch (e) {
      console.error('[consult] could not start the payment; releasing the slot', e);
      await sql()`DELETE FROM clinic_appointments WHERE ref = ${ref}`;
      return { ok: false, error: 'unavailable' };
    }
  }

  try {
    await finalise(ref, token);
  } catch (e) {
    console.error('[consult] could not create the calendar event; releasing the slot', e);
    await sql()`DELETE FROM clinic_appointments WHERE ref = ${ref}`;
    return { ok: false, error: 'unavailable' };
  }
  return { ok: true, ref, token, status };
}

/** Creates the Google event and sends the emails for a confirmed appointment. */
async function finalise(ref: string, token: string) {
  const a = (await appointmentByRef(ref))!;
  const ev = await createEvent({
    ref,
    summary: `Online consultation with ${a.doctor_name} · AVVVS Clinic`,
    description: `Online consultation at ${CLINIC.name}.\nPatient: ${a.name}\nTo change the time: ${manageUrl(ref, token)}\nTo cancel, call the clinic: ${CLINIC.phones.join(' or ')} (booking ${ref}).\nNot for emergencies: call 112 or 108.`,
    start: new Date(a.starts_at), end: new Date(a.ends_at),
    attendees: [{ email: a.email, name: a.name }, ...(a.doctor_email ? [{ email: a.doctor_email, name: a.doctor_name }] : [])],
  });
  await sql()`UPDATE clinic_appointments SET google_event_id = ${ev.id}, meet_url = ${ev.meetUrl}, status = 'confirmed', hold_token = NULL WHERE ref = ${ref}`;
  const when = fmtWhen(a.starts_at);
  const paid: [string, string][] = a.payment_status === 'paid' && a.amount_paise ? [['Paid', `${rupees(a.amount_paise)} (reference ${a.payment_ref ?? ''})`]] : [];
  await Promise.all([
    sendMail({
      to: a.email, subject: `Your online consultation: ${fmtDate(a.starts_at)}, ${fmtTime(a.starts_at)} · AVVVS Clinic`,
      title: `You’re booked, ${a.name.split(/\s+/)[0]}.`,
      rows: [['Doctor', a.doctor_name ?? ''], ['When', when], ['Where', 'Google Meet (video call)'], ['Booking', ref], ...paid],
      message: `Join from a quiet, well-lit place a few minutes early, with any recent reports and a list of your medicines to hand. To cancel, call the clinic on ${CLINIC.phones.join(' or ')} with your booking reference; cancelling ${CANCEL_CUTOFF_MIN / 60} hours or more before the start is free${paid.length ? ' and your fee is refunded in full' : ''}. An online consultation is not for emergencies: call 112 or 108.`,
      button: { label: 'Join or change the time', url: manageUrl(ref, token) },
    }),
    sendMail({
      to: [clinicInbox(), ...(a.doctor_email ? [a.doctor_email] : [])], replyTo: a.email,
      subject: `Online consultation booked: ${a.name} with ${a.doctor_name}, ${fmtDate(a.starts_at)} ${fmtTime(a.starts_at)}`,
      title: 'New online consultation',
      rows: [['Doctor', a.doctor_name ?? ''], ['When', when], ['Patient', a.name], ['Phone', a.phone], ['Email', a.email], ['Age', a.age || '—'], ['Meet', ev.meetUrl || '—'], ...paid],
      message: a.note || '(no note)', foot: 'Manage this appointment in the clinic admin, under Consultations.',
    }),
  ]);
}

// ---------- payment ----------

export type PaidResult = 'confirmed' | 'already' | 'refunded' | 'unknown';

/**
 * A payment has arrived for a held appointment (from the browser's return or the gateway's webhook;
 * both may call this, in either order, and only the first does anything).
 *  - Normally the hold becomes a confirmed appointment.
 *  - If the hold had lapsed and the time is still free, it is brought back and confirmed.
 *  - If the time has gone to someone else, the amount is wrong, or the video link cannot be made,
 *    the money is sent straight back and the patient is told.
 */
export async function confirmPaid(paid: Paid): Promise<PaidResult> {
  await ensureSchema();
  const found = await sql()`SELECT ref FROM clinic_appointments WHERE payment_order_ref = ${paid.orderRef} LIMIT 1`;
  if (!found.length) return 'unknown';
  const ref = String(found[0].ref);
  let claimed = false, slotGone = false;
  try {
    const r = await sql()`UPDATE clinic_appointments
      SET payment_status = 'paid', payment_ref = ${paid.paymentRef}, hold_expires_at = NULL, status = 'pending_payment', cancelled_at = NULL
      WHERE ref = ${ref} AND payment_status = 'pending' AND status IN ('pending_payment', 'cancelled') RETURNING id`;
    claimed = r.length > 0;
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // the hold had lapsed and someone else now has this time: record the payment, then give it back
    const r = await sql()`UPDATE clinic_appointments SET payment_status = 'paid', payment_ref = ${paid.paymentRef}
      WHERE ref = ${ref} AND payment_status = 'pending' RETURNING id`;
    claimed = r.length > 0; slotGone = true;
  }
  if (!claimed) return 'already';

  const a = (await appointmentByRef(ref))!;
  let problem = slotGone ? 'the time had been taken by someone else before the payment arrived' : '';
  if (!problem && paid.amountPaise !== a.amount_paise) problem = `the amount paid (${rupees(paid.amountPaise)}) is not the fee (${rupees(a.amount_paise ?? 0)})`;
  if (!problem) {
    try {
      await finalise(ref, a.hold_token ? unseal(a.hold_token) : '');
      return 'confirmed';
    } catch (e) {
      console.error('[consult] paid, but the calendar event could not be created; refunding', e);
      problem = 'the video link could not be created';
    }
  }
  await sql()`UPDATE clinic_appointments SET status = 'cancelled', cancelled_at = now(), hold_token = NULL WHERE ref = ${ref}`;
  const back = await refundPayment({ ...a, payment_status: 'paid', payment_ref: paid.paymentRef, amount_paise: paid.amountPaise });
  await Promise.all([
    sendMail({
      to: a.email, subject: 'Your online consultation could not be booked · AVVVS Clinic', title: 'We could not book this consultation.',
      rows: [['Doctor', a.doctor_name ?? ''], ['Time asked for', fmtWhen(a.starts_at)], ['Paid', rupees(paid.amountPaise)]],
      message: `We are sorry: ${problem}. ${back ? 'Your payment is being refunded in full to the account or card you paid from; it normally arrives within 5 to 10 working days.' : `Your payment will be refunded in full; the clinic will be in touch. You can also call ${CLINIC.phones[0]}.`} Please choose another time.`,
      button: { label: 'Choose another time', url: abs('/consult') },
    }),
    sendMail({
      to: clinicInbox(), subject: `Online consultation paid but not booked: ${a.name}, ${rupees(paid.amountPaise)}`, title: 'Paid, but not booked',
      rows: [['Patient', a.name], ['Phone', a.phone], ['Email', a.email], ['Doctor', a.doctor_name ?? ''], ['Time asked for', fmtWhen(a.starts_at)], ['Payment', paid.paymentRef], ['Refund', back ? 'started automatically' : 'NOT started: refund it in the Razorpay dashboard']],
      message: `Why: ${problem}.`,
    }),
  ]);
  return 'refunded';
}

/** Sends a paid fee back. Never throws: if the gateway refuses, the clinic is emailed to refund it by hand. */
export async function refundPayment(a: Appointment): Promise<boolean> {
  if (a.payment_status !== 'paid' || !a.payment_ref || !a.amount_paise) return false;
  // claim the refund first, so two cancellations at once cannot refund twice
  const mine = await sql()`UPDATE clinic_appointments SET payment_status = 'refunded', refunded_at = now() WHERE id = ${a.id} AND payment_status = 'paid' RETURNING id`;
  if (!mine.length) return false;
  try {
    const provider = providerById(a.payment_provider);
    if (!provider) throw new Error(`The ${a.payment_provider ?? 'payment'} keys are not set, so the refund cannot be sent.`);
    const refundRef = await provider.refund(a.payment_ref, a.amount_paise, a.ref);
    await sql()`UPDATE clinic_appointments SET refund_ref = ${refundRef} WHERE id = ${a.id}`;
    return true;
  } catch (e) {
    console.error('[consult] the refund could not be started', e);
    await sql()`UPDATE clinic_appointments SET payment_status = 'paid', refunded_at = NULL WHERE id = ${a.id}`;
    await sendMail({
      to: clinicInbox(), subject: `Refund needed by hand: ${a.name}, ${rupees(a.amount_paise)}`, title: 'A refund could not be started automatically',
      rows: [['Patient', a.name], ['Phone', a.phone], ['Email', a.email], ['Amount', rupees(a.amount_paise)], ['Payment', a.payment_ref], ['Booking', a.ref]],
      message: 'Please refund this payment in the Razorpay dashboard (Transactions, Payments, open the payment, Issue Refund), then mark it refunded in the clinic admin.',
    });
    return false;
  }
}

/** The patient closed the payment window: give the time back at once instead of waiting for the hold to lapse. */
export async function releaseHold(ref: string) {
  await sql()`UPDATE clinic_appointments SET status = 'cancelled', cancelled_at = now() WHERE ref = ${ref} AND status = 'pending_payment' AND payment_status = 'pending'`;
}

// ---------- changes ----------

export async function cancelAppointment(a: Appointment, by: 'patient' | 'clinic') {
  if (a.status !== 'confirmed' && a.status !== 'pending_payment') return false;
  await sql()`UPDATE clinic_appointments SET status = 'cancelled', cancelled_at = now() WHERE id = ${a.id}`;
  await deleteEvent(a.google_event_id);
  const when = fmtWhen(a.starts_at);
  // a patient can only cancel here while a full refund is still due (canPatientChange); the clinic's own cancellation always refunds
  const wasPaid = a.payment_status === 'paid' && !!a.amount_paise;
  const refunded = wasPaid ? await refundPayment(a) : false;
  const money = !wasPaid ? '' : refunded
    ? ` Your payment of ${rupees(a.amount_paise!)} is being refunded in full to the account or card you paid from; it normally arrives within 5 to 10 working days.`
    : ` Your payment of ${rupees(a.amount_paise!)} will be refunded in full; the clinic will be in touch.`;
  await Promise.all([
    sendMail({
      to: a.email, subject: 'Your online consultation is cancelled · AVVVS Clinic', title: 'Your consultation is cancelled.',
      rows: [['Doctor', a.doctor_name ?? ''], ['Was', when]],
      message: by === 'clinic' ? `The clinic had to cancel this consultation. We are sorry. Please book another time, or call ${CLINIC.phones[0]}.${money}` : `You can book another time whenever suits you.${money}`,
      button: { label: 'Book another time', url: abs('/consult') },
    }),
    sendMail({
      to: [clinicInbox(), ...(a.doctor_email ? [a.doctor_email] : [])],
      subject: `Online consultation cancelled by the ${by}: ${a.name}, ${fmtDate(a.starts_at)} ${fmtTime(a.starts_at)}`,
      title: 'Online consultation cancelled', rows: [['Doctor', a.doctor_name ?? ''], ['Was', when], ['Patient', a.name], ['Phone', a.phone], ...(wasPaid ? [['Refund', refunded ? `${rupees(a.amount_paise!)}, started automatically` : `${rupees(a.amount_paise!)}, NOT started: see the separate email`] as [string, string]] : [])], message: `Cancelled by the ${by}.`,
    }),
  ]);
  return true;
}

export type MoveResult = { ok: true } | { ok: false; error: 'taken' | 'failed' };

export async function rescheduleAppointment(a: Appointment, startIso: string, by: 'patient' | 'clinic'): Promise<MoveResult> {
  if (a.status !== 'confirmed') return { ok: false, error: 'failed' };
  const minutes = Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60_000);
  const start = new Date(startIso), end = new Date(start.getTime() + minutes * 60_000);
  // the clinic may move an appointment at shorter notice than a patient can book
  const free = await slotIsFree({ id: a.doctor_id, online_minutes: a.doctor_minutes ?? minutes }, startIso, { ignoreAppointment: a.id, notice: by === 'clinic' ? 0 : undefined });
  if (!free) return { ok: false, error: 'taken' };
  try {
    await sql()`UPDATE clinic_appointments SET starts_at = ${start.toISOString()}, ends_at = ${end.toISOString()}, reminder_sent_at = NULL WHERE id = ${a.id}`;
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: 'taken' };
    throw e;
  }
  try { await moveEvent(a.google_event_id, start, end); } catch (e) { console.error('[consult] could not move the calendar event', e); }
  const when = fmtWhen(start);
  await Promise.all([
    sendMail({
      to: a.email, subject: `Your online consultation has moved: ${fmtDate(start)}, ${fmtTime(start)} · AVVVS Clinic`, title: 'Your consultation has a new time.',
      rows: [['Doctor', a.doctor_name ?? ''], ['New time', when], ['Was', fmtWhen(a.starts_at)]],
      message: by === 'clinic' ? `The clinic moved this consultation. If the new time does not suit you, call ${CLINIC.phones[0]}.` : 'The video link is the same as before.',
    }),
    sendMail({
      to: [clinicInbox(), ...(a.doctor_email ? [a.doctor_email] : [])],
      subject: `Online consultation moved by the ${by}: ${a.name}, now ${fmtDate(start)} ${fmtTime(start)}`,
      title: 'Online consultation moved', rows: [['Doctor', a.doctor_name ?? ''], ['New time', when], ['Was', fmtWhen(a.starts_at)], ['Patient', a.name], ['Phone', a.phone]], message: `Moved by the ${by}.`,
    }),
  ]);
  return { ok: true };
}

/** Slots held for a payment that never came are released. */
export async function releaseExpiredHolds() {
  await sql()`UPDATE clinic_appointments SET status = 'cancelled', cancelled_at = now() WHERE status = 'pending_payment' AND payment_status = 'pending' AND hold_expires_at < now()`;
}

/** A calendar file for the patient's own calendar. */
export function icsFor(a: Appointment) {
  const t = (d: string) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AVVVS Clinic//Online consultation//EN', 'BEGIN:VEVENT',
    `UID:${a.ref}@clinic.avvvs.com`, `DTSTAMP:${t(new Date().toISOString())}`, `DTSTART:${t(a.starts_at)}`, `DTEND:${t(a.ends_at)}`,
    `SUMMARY:Online consultation with ${a.doctor_name} (AVVVS Clinic)`, `LOCATION:${a.meet_url ?? 'Google Meet'}`,
    `DESCRIPTION:Join: ${a.meet_url ?? ''}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
