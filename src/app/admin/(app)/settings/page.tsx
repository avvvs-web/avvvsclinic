import { requireAdmin } from '@/lib/auth';
import { isLocalDatabase } from '@/lib/db';
import { canCreateEvents, googleStatus } from '@/lib/google';
import { fmtDate } from '@/lib/consult';
import { onlineBookingOn } from '@/lib/content';
import { paymentOn } from '@/lib/payments';
import { razorpayConfigured, razorpayMode, razorpayWebhookReady } from '@/lib/payments-razorpay';
import { onlineDoctorRows } from '@/lib/slots';
import { OnlineSwitch } from './OnlineSwitch';
import { SettingsControls } from './SettingsControls';

export const metadata = { title: 'Settings' };

const NOTE: Record<string, { ok?: string; error?: string }> = {
  connected: { ok: 'Google Calendar is connected. Use “Send a test” to check it end to end.' },
  refused: { error: 'Google access was not granted. Nothing was changed.' },
  state: { error: 'That sign-in attempt expired. Please try again.' },
  failed: { error: 'Google could not be connected. See the server log for the reason, then try again.' },
  'not-configured': { error: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set yet.' },
};

export default async function Settings({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  await requireAdmin();
  const g = await googleStatus();
  const note = NOTE[(await searchParams).google ?? ''];
  const smtp = !!process.env.SMTP_HOST?.trim();
  const secret = !!process.env.APP_SECRET?.trim();
  const cron = !!process.env.CRON_SECRET?.trim();
  const local = isLocalDatabase();
  const paying = paymentOn(), keys = razorpayConfigured(), hook = razorpayWebhookReady(), asked = process.env.PAYMENT_PROVIDER?.trim() === 'razorpay';
  const on = await onlineBookingOn();
  const online = (await onlineDoctorRows().catch(() => [])).length;
  const live = on && online > 0 && (await canCreateEvents());

  return (
    <div className="ad-page ad-narrow" style={{ maxWidth: 760 }}>
      <h1>Settings</h1>
      {note && <p className={`ad-note ${note.error ? 'ad-note-error' : 'ad-note-ok'}`} role="status">{note.error || note.ok}</p>}

      <section className="ad-card">
        <div className="ad-card-top">
          <h2>Online booking</h2>
          <span className={`ad-pill ad-pill-${live ? 'published' : 'draft'}`}>{live ? 'Open to patients' : 'Closed to patients'}</span>
        </div>
        <p className="ad-muted">
          {!on ? 'Switched off. The online consultation page asks patients to call the clinic instead.'
            : live ? `Patients can book online consultations with ${online === 1 ? 'one doctor' : `${online} doctors`}.`
            : `Switched on, but patients cannot book yet: ${[!g.connected && !local ? 'connect Google Calendar below' : '', !online ? 'switch online consultations on for at least one doctor, under Doctors' : ''].filter(Boolean).join(', and ')}.`}
        </p>
        <OnlineSwitch on={on} />
      </section>

      <section className="ad-card">
        <div className="ad-card-top">
          <h2>Google Calendar and Meet</h2>
          <span className={`ad-pill ad-pill-${g.connected ? 'published' : 'draft'}`}>{g.connected ? 'Connected' : 'Not connected'}</span>
        </div>
        {g.connected ? (
          <p className="ad-muted">Connected as <b>{g.email || 'the clinic’s Google account'}</b>{g.since ? ` since ${fmtDate(g.since)}` : ''}. Every online consultation is added to this account’s calendar with a Meet link, and the patient and the doctor are invited.</p>
        ) : g.configured ? (
          <p className="ad-muted">Sign in with the clinic’s Google account and allow access to its calendar. Online booking opens as soon as this is done.</p>
        ) : (
          <p className="ad-muted">Before connecting, add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to the site’s environment (see <code>docs/ENV.md</code>), then redeploy.{local && ' On this computer, bookings work without Google and use a placeholder Meet link.'}</p>
        )}
        <SettingsControls configured={g.configured} connected={g.connected} />
      </section>

      <section className="ad-card">
        <div className="ad-card-top">
          <h2>Online payment</h2>
          <span className={`ad-pill ad-pill-${paying ? 'published' : 'draft'}`}>{paying ? (razorpayMode() === 'live' ? 'On' : 'On, test mode') : 'Off'}</span>
        </div>
        <p className="ad-muted">
          {paying
            ? `Patients pay a doctor’s fee through Razorpay when they book${razorpayMode() === 'live' ? '' : ' (test mode: no real money moves)'}. Doctors with no fee are booked free. Cancellations are refunded automatically.${hook ? '' : ' The webhook secret is missing: without it, a patient whose browser closes during payment is not confirmed. Add RAZORPAY_WEBHOOK_SECRET.'}`
            : asked && !keys ? 'PAYMENT_PROVIDER is set to razorpay, but the Razorpay key and secret are not, so payment stays off.'
            : 'Online consultations are booked without paying on the website. To take the fee at booking, see docs/ENV.md, section 7.'}
        </p>
      </section>

      <section className="ad-card">
        <h2>Checklist</h2>
        <ul className="ad-checklist">
          <li className={g.connected ? 'is-ok' : ''}>Google Calendar connected</li>
          <li className={smtp ? 'is-ok' : ''}>Email (SMTP) set up, so confirmations reach patients</li>
          <li className={secret ? 'is-ok' : ''}><code>APP_SECRET</code> set, to protect the Google connection</li>
          <li className={cron ? 'is-ok' : ''}><code>CRON_SECRET</code> set, so morning reminders are sent</li>
        </ul>
        <p className="ad-muted">Then switch online consultations on for each doctor, under Doctors.</p>
      </section>
    </div>
  );
}
