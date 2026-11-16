import { appointmentForPatient, confirmPaid, releaseHold } from '@/lib/appointments';
import { providerById } from '@/lib/payments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
 * The browser's return from the payment window, for a held online consultation.
 *  - action "release": the patient closed the window without paying, so the time is given back.
 *  - otherwise: the gateway's signed result. It is checked, the payment is read back from the
 *    gateway, and the appointment is confirmed (or refunded, if it can no longer be honoured).
 * The patient proves the booking is theirs with the token they were given when the hold was made.
 * The gateway's webhook does the same confirmation on its own, in case this call never arrives.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const ref = String(body.ref ?? ''), token = String(body.token ?? '');
  const a = await appointmentForPatient(ref, token);
  if (!a) return Response.json({ ok: false, error: 'not-found' }, { status: 404 });

  if (body.action === 'release') {
    await releaseHold(a.ref);
    return Response.json({ ok: true });
  }

  const provider = providerById(a.payment_provider);
  if (!provider || !a.payment_order_ref) return Response.json({ ok: false, error: 'bad-request' }, { status: 400 });
  try {
    // only this appointment's own order is accepted, before anything is asked of the gateway
    if (String(body.razorpay_order_id ?? '') !== a.payment_order_ref) return Response.json({ ok: false, error: 'not-paid' }, { status: 402 });
    const paid = await provider.verifyReturn(body);
    if (!paid) return Response.json({ ok: false, error: 'not-paid' }, { status: 402 });
    const result = await confirmPaid(paid);
    if (result === 'refunded') return Response.json({ ok: false, error: 'refunded' }, { status: 409 });
    return Response.json({ ok: true });
  } catch (e) {
    // the payment may well have gone through: the webhook will settle it, and the patient is told to wait for the email
    console.error('[consult] could not confirm a payment from the browser', e);
    return Response.json({ ok: false, error: 'unconfirmed' }, { status: 502 });
  }
}
