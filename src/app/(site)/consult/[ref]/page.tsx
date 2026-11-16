import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ManageAppointment } from '@/components/ManageAppointment';
import { appointmentForPatient, canPatientChange } from '@/lib/appointments';
import { fmtDate, fmtTime, rupees } from '@/lib/consult';
import { CLINIC, tel } from '@/lib/site';

// A patient's own appointment: private (reached only with the emailed link) and never indexed.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your online consultation', robots: { index: false, follow: false } };

export default async function AppointmentPage({ params, searchParams }: { params: Promise<{ ref: string }>; searchParams: Promise<{ t?: string; new?: string }> }) {
  const { ref } = await params;
  const { t = '', new: isNew } = await searchParams;
  const a = await appointmentForPatient(ref, t);
  if (!a) notFound();
  const first = a.name.split(/\s+/)[0];
  const cancelled = a.status === 'cancelled';
  // online payment: a hold that was never paid for, or a payment that has arrived and is being confirmed
  const unpaid = a.status === 'pending_payment' && a.payment_status === 'pending';
  const confirming = a.status === 'pending_payment' && a.payment_status === 'paid';
  const money = a.amount_paise && a.payment_status === 'paid' ? `${rupees(a.amount_paise)} paid`
    : a.amount_paise && a.payment_status === 'refunded' ? `${rupees(a.amount_paise)}, refunded to the account or card you paid from` : '';
  const over = a.status === 'completed' || a.status === 'no_show' || new Date(a.ends_at).getTime() < Date.now();

  return (
    <main id="main" className="mist">
      <div className="bk">
        <div className="bk-card">
          <div className="bk-done">
            {!cancelled && !over && !unpaid && !confirming && isNew && <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" /><path d="M20 33 l8 8 l16 -18" /></svg>}
            <h1 className="t-2">{unpaid ? 'This booking was not paid for.' : confirming ? 'Payment received.' : cancelled ? 'This consultation is cancelled.' : over ? 'This consultation is over.' : isNew ? `You’re booked, ${first}.` : 'Your online consultation'}</h1>
            <dl className="appt">
              <div><dt>Doctor</dt><dd>{a.doctor_name}</dd></div>
              <div><dt>Day</dt><dd>{fmtDate(a.starts_at)}</dd></div>
              <div><dt>Time</dt><dd>{fmtTime(a.starts_at)} <span className="muted">India time</span></dd></div>
              {money && <div><dt>Fee</dt><dd>{money}</dd></div>}
            </dl>
            {unpaid && <p className="small">The time was held while the payment window was open, and nothing was charged. Book again to choose a time.</p>}
            {confirming && <p className="small">Your booking is being confirmed. The email with the video link will reach {a.email} in a few minutes; this page will show it too when you reload.</p>}
            {!cancelled && !over && !unpaid && !confirming && (
              <>
                {a.meet_url && <a className="btn" href={a.meet_url} target="_blank" rel="noopener">Join with Google Meet</a>}
                <p className="small">The link is also in the email sent to {a.email}. Join a few minutes early, from a quiet, well-lit place.</p>
                <ManageAppointment refId={a.ref} token={t} doctor={a.doctor_slug ?? ''} current={a.starts_at} canChange={canPatientChange(a)} paid={!!a.amount_paise && a.payment_status === 'paid'} />
              </>
            )}
            {(cancelled || over || unpaid) && <Link className="btn" href="/consult">Book another consultation</Link>}
            <p className="small">Not for emergencies: call 112 or 108. Questions? Call <a href={tel(CLINIC.phones[0])}>{CLINIC.phones[0]}</a>.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
