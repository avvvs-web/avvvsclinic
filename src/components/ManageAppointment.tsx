'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CANCEL_CUTOFF_MIN } from '@/lib/consult';
import { CLINIC, tel } from '@/lib/site';
import { SlotPicker, useSlots } from './SlotPicker';

const HOURS = CANCEL_CUTOFF_MIN / 60;

/** The cancellation policy in short, beside the clinic's numbers: patients cancel by calling. */
function CancelStep({ refId, paid, onBack }: { refId: string; paid: boolean; onBack: () => void }) {
  return (
    <div className="manage-cancel" role="region" aria-labelledby="cancel-title">
      <h2 id="cancel-title" className="t-3">To cancel, call the clinic.</h2>
      <p className="small">Cancellations are made by phone, so the clinic can offer you another time first. Have your booking reference ready: <b>{refId}</b>.</p>
      <div className="actions">
        {CLINIC.phones.map((p) => <a key={p} className="btn" href={tel(p)}>Call {p}</a>)}
      </div>
      <h3>Cancellation policy</h3>
      <ul className="small">
        <li><b>{HOURS} hours or more before the start:</b> no charge{paid ? '; the full fee is refunded to the account or card you paid from' : ''}.</li>
        {paid
          ? <li><b>Less than {HOURS} hours before, or if you do not join:</b> the fee is not normally refunded, because the doctor’s time was kept for you. If something serious stopped you, tell the clinic and it will consider a refund or a new time.</li>
          : <li><b>Less than {HOURS} hours before:</b> please still call, so the doctor’s time can go to someone else.</li>}
        <li><b>Changing the time instead</b> is free, and you can do it here up to {HOURS} hours before.</li>
      </ul>
      <p className="small">{paid ? 'Refunds normally reach you within 5 to 10 working days. ' : ''}<Link href="/refunds#cancel" target="_blank">The full cancellation policy</Link></p>
      <button type="button" className="cc-link" onClick={onBack}>Keep my consultation</button>
    </div>
  );
}

/** Add to calendar, move, or the step to cancel by phone: the patient's controls on their own appointment page. */
export function ManageAppointment({ refId, token, doctor, current, canChange, paid = false }: { refId: string; token: string; doctor: string; current: string; canChange: boolean; paid?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'move' | 'cancel'>('idle');
  const [start, setStart] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const { days, failed, reload } = useSlots(mode === 'move' ? doctor : '');

  async function reschedule() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch(`/api/consult/${refId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action: 'reschedule', start }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setMode('idle'); setStart(''); router.replace(`/consult/${refId}?t=${token}`); router.refresh(); return; }
      if (j.error === 'taken') { setMsg('That time has just been taken. Please choose another.'); setStart(''); reload(); }
      else if (j.error === 'too-late') setMsg(`It is too close to the consultation to change it here. Please call ${CLINIC.phones[0]}.`);
      else setMsg(`That did not work. Please try again, or call ${CLINIC.phones[0]}.`);
    } catch { setMsg(`That did not work. Please try again, or call ${CLINIC.phones[0]}.`); }
    finally { setBusy(false); }
  }

  return (
    <div className="manage">
      <div className="actions">
        <a className="more" href={`/api/consult/${refId}/ics?t=${encodeURIComponent(token)}`}>Add to my calendar</a>
        {canChange && mode === 'idle' && <button type="button" className="cc-link" onClick={() => setMode('move')}>Change the time</button>}
        {mode === 'idle' && <button type="button" className="cc-link" onClick={() => { setMode('cancel'); setMsg(''); }}>Cancel</button>}
      </div>
      {!canChange && mode === 'idle' && <p className="small">It is too close to the time to change it here. To change it, please call {CLINIC.phones[0]}.</p>}
      {mode === 'cancel' && <CancelStep refId={refId} paid={paid} onBack={() => setMode('idle')} />}
      {mode === 'move' && (
        <div className="manage-move">
          <SlotPicker days={days ? days.map((d) => ({ ...d, slots: d.slots.filter((s) => s !== current) })).filter((d) => d.slots.length) : days} failed={failed} value={start} onChange={setStart} />
          <div className="actions">
            <button type="button" className="btn" disabled={!start || busy} onClick={() => void reschedule()}>{busy ? 'Moving…' : 'Move to this time'}</button>
            <button type="button" className="cc-link" onClick={() => { setMode('idle'); setStart(''); setMsg(''); }}>Keep my time</button>
          </div>
        </div>
      )}
      {msg && <p className="err" role="alert">{msg}</p>}
    </div>
  );
}
