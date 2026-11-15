'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, stagger } from 'animejs';
import { fmtTime, type DaySlots } from '@/lib/consult';
import { DayPicker, dayLong, dayShort } from './DayPicker';

/** Free slots for a doctor: a row of days, then that day's times. Shared by booking and rescheduling. */
export function useSlots(doctor: string) {
  const [days, setDays] = useState<DaySlots[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!doctor) return;
    let live = true;
    setDays(null); setFailed(false);
    fetch(`/api/consult/slots?doctor=${encodeURIComponent(doctor)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (live) { if (j.ok) setDays(j.days); else setFailed(true); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [doctor, n]);
  return { days, failed, reload: () => setN((x) => x + 1) };
}

/** The hour in India, for grouping times into parts of the day. */
const hourIST = (iso: string) => Number(new Date(iso).toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }));
const PARTS = [
  { id: 'morning', label: 'Morning', test: (h: number) => h < 12 },
  { id: 'afternoon', label: 'Afternoon', test: (h: number) => h >= 12 && h < 17 },
  { id: 'evening', label: 'Evening', test: (h: number) => h >= 17 },
];

/**
 * Choosing a free time: the soonest one offered as a single tap, a calendar of the next weeks
 * with free days marked, then that day's times grouped into morning, afternoon and evening.
 */
export function SlotPicker({ days, failed, value, onChange }: { days: DaySlots[] | null; failed: boolean; value: string; onChange: (iso: string) => void }) {
  const [day, setDay] = useState('');
  const times = useRef<HTMLFieldSetElement>(null);
  // times are the clinic's (India); visitors elsewhere also see their own
  const [abroad, setAbroad] = useState<string | null>(null);
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && new Date().getTimezoneOffset() !== -330) setAbroad(tz);
  }, []);
  useEffect(() => {
    if (!days?.length) return;
    const holding = days.find((d) => d.slots.includes(value));
    setDay((cur) => holding?.date ?? (days.some((d) => d.date === cur) ? cur : days[0].date));
  }, [days, value]);
  // a new day's times arrive in a short cascade
  useEffect(() => {
    const el = times.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animate(el.querySelectorAll('.t-part'), { opacity: [0, 1], y: [8, 0], duration: 500, delay: stagger(60), ease: 'outExpo' });
    animate(el.querySelectorAll('.opt.time'), { opacity: [0, 1], scale: [0.96, 1], duration: 450, delay: stagger(18, { start: 60 }), ease: 'outExpo' });
  }, [day]);

  if (failed) return <p className="err" role="alert">The free times could not be loaded. Please try again in a moment.</p>;
  if (!days) return <div className="slot-wait" aria-live="polite"><span className="shimmer" /><span className="shimmer" /><span className="shimmer" /><p className="small">Finding free times…</p></div>;
  if (!days.length) return <p className="note">No free times in the next three weeks. Please call the clinic and we will find one for you.</p>;

  const slots = days.find((d) => d.date === day)?.slots ?? [];
  const soonest = days[0].slots[0];
  const groups = PARTS.map((p) => ({ ...p, slots: slots.filter((s) => p.test(hourIST(s))) })).filter((g) => g.slots.length);

  return (
    <div className="slot-pick">
      {soonest && (
        <button type="button" className={`soonest${value === soonest ? ' is-on' : ''}`} onClick={() => { setDay(days[0].date); onChange(soonest); }}>
          <span>Earliest free time</span>
          <b>{dayShort(days[0].date)}, {fmtTime(soonest)}</b>
          <em aria-hidden="true">{value === soonest ? 'Chosen' : 'Take it'}</em>
        </button>
      )}

      <DayPicker dates={days.map((d) => d.date)} value={day} label="Or choose a day"
        count={(iso) => days.find((d) => d.date === iso)?.slots.length ?? 0}
        onChange={(d) => { setDay(d); if (!days.find((x) => x.date === d)?.slots.includes(value)) onChange(''); }} />

      <fieldset className="t-groups" ref={times}>
        <legend className="bk-label">{dayLong(day)} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>· India time</span></legend>
        {groups.map((g) => (
          <div key={`${day}-${g.id}`} className="t-part">
            <p className="t-head">{g.label}</p>
            <div className="times">
              {g.slots.map((s) => (
                <label key={s} className="opt time">
                  <input type="radio" name="slot" checked={value === s} onChange={() => onChange(s)} />
                  <b>{fmtTime(s)}</b>
                  {abroad && <small>{fmtTime(s, abroad)} your time</small>}
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
    </div>
  );
}
