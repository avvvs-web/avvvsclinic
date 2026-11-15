'use client';

import { useState, useTransition } from 'react';
import { setOnlineBooking, type FormState } from '../../actions';
import { Note } from '../../AdminForms';

/** The master switch for online consultations. */
export function OnlineSwitch({ on: start }: { on: boolean }) {
  const [on, setOn] = useState(start);
  const [msg, setMsg] = useState<FormState>({});
  const [pending, go] = useTransition();
  const flip = () => {
    const next = !on;
    if (!next && !confirm('Switch online booking off? Patients can no longer book online consultations. Existing appointments stay, and patients can still change or cancel them.')) return;
    go(async () => { const r = await setOnlineBooking(next); setMsg(r); if (!r.error) setOn(next); });
  };
  return (
    <>
      <div className="ad-switch-row">
        <button type="button" role="switch" aria-checked={on} aria-label="Online booking" className={`ad-switch${on ? ' is-on' : ''}`} disabled={pending} onClick={flip}><span /></button>
        <b>{on ? 'On' : 'Off'}</b>
      </div>
      <Note s={msg} />
    </>
  );
}
