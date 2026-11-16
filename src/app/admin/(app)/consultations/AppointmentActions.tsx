'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SlotPicker, useSlots } from '@/components/SlotPicker';
import { adminCancel, adminRefund, adminReschedule, setOutcome } from '../../consult-actions';
import type { FormState } from '../../actions';

/** What staff can do with one appointment: join, move, cancel, or record how it went. */
export function AppointmentActions({ refId, status, paid, meet, doctor, current, started }: { refId: string; status: string; /** the fee, when it was paid online and not yet refunded */ paid: string; meet: string | null; doctor: string; current: string; started: boolean }) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const [start, setStart] = useState('');
  const [msg, setMsg] = useState<FormState>({});
  const [pending, go] = useTransition();
  const { days, failed } = useSlots(moving ? doctor : '');
  const run = (fn: () => Promise<FormState>) => go(async () => { const r = await fn(); setMsg(r); if (!r.error) { setMoving(false); setStart(''); router.refresh(); } });

  // a cancelled appointment still shows Refund while its fee is held (a refund that could not be started automatically)
  if (status === 'cancelled' && !paid) return null;
  return (
    <div className="ad-appt-actions">
      <div className="ad-user-controls">
        {status === 'confirmed' && meet && <a href={meet} target="_blank" rel="noopener">Open Meet</a>}
        {status === 'confirmed' && !started && <button type="button" className="ad-link" disabled={pending} onClick={() => setMoving((m) => !m)}>{moving ? 'Keep the time' : 'Move'}</button>}
        {status === 'confirmed' && !started && <button type="button" className="ad-link ad-danger" disabled={pending} onClick={() => { if (confirm(paid ? `Cancel this consultation and refund ${paid}? The patient and the doctor are emailed.` : 'Cancel this consultation? The patient and the doctor are emailed.')) run(() => adminCancel(refId)); }}>Cancel</button>}
        {paid && status !== 'confirmed' && status !== 'pending_payment' && <button type="button" className="ad-link" disabled={pending} onClick={() => { if (confirm(`Refund ${paid} to the patient? This cannot be undone.`)) run(() => adminRefund(refId)); }}>Refund {paid}</button>}
        {status === 'confirmed' && started && <button type="button" className="ad-link" disabled={pending} onClick={() => run(() => setOutcome(refId, 'completed'))}>Completed</button>}
        {status === 'confirmed' && started && <button type="button" className="ad-link" disabled={pending} onClick={() => run(() => setOutcome(refId, 'no_show'))}>Did not attend</button>}
        {(status === 'completed' || status === 'no_show') && <button type="button" className="ad-link" disabled={pending} onClick={() => run(() => setOutcome(refId, 'confirmed'))}>Undo</button>}
      </div>
      {moving && (
        <div className="ad-move">
          <SlotPicker days={days ? days.map((d) => ({ ...d, slots: d.slots.filter((s) => s !== current) })).filter((d) => d.slots.length) : days} failed={failed} value={start} onChange={setStart} />
          <button type="button" className="ad-btn" disabled={!start || pending} onClick={() => run(() => adminReschedule(refId, start))}>{pending ? 'Moving…' : 'Move to this time'}</button>
        </div>
      )}
      {msg.error && <p className="ad-note ad-note-error" role="alert">{msg.error}</p>}
    </div>
  );
}
