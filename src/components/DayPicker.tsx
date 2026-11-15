'use client';

/**
 * A small month-style calendar for the booking window: a week to a row, every day visible at once,
 * days with no free time greyed out. Replaces the sideways-scrolling strip of day chips.
 * Dates are plain 'YYYY-MM-DD' strings.
 */

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const toDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => toDate(iso).toLocaleDateString('en-IN', { ...o, timeZone: 'UTC' });

/** Every date from the first to the last given, so the grid has no gaps. */
function span(dates: string[]) {
  if (!dates.length) return [];
  const sorted = [...dates].sort();
  const out: string[] = [];
  for (let d = toDate(sorted[0]); toIso(d) <= sorted[sorted.length - 1]; d = new Date(d.getTime() + 86400000)) out.push(toIso(d));
  return out;
}

export function DayPicker({ dates, value, onChange, count, label = 'Day', name = 'day' }: {
  /** the days that can be chosen */
  dates: string[];
  value: string;
  onChange: (iso: string) => void;
  /** free times on a day, shown as a hint under the date */
  count?: (iso: string) => number;
  label?: string;
  name?: string;
}) {
  const all = span(dates);
  if (!all.length) return null;
  const open = new Set(dates);
  const lead = (toDate(all[0]).getUTCDay() + 6) % 7; // Monday first
  const first = fmt(all[0], { month: 'long', year: 'numeric' });
  const last = fmt(all[all.length - 1], { month: 'long', year: 'numeric' });
  const title = first === last ? first : `${fmt(all[0], { month: 'long' })} – ${last}`;

  return (
    <fieldset className="cal">
      <legend className="bk-label">{label}</legend>
      <p className="cal-month" aria-hidden="true">{title}</p>
      <div className="cal-grid">
        {WEEK.map((w) => <span key={w} className="cal-wd" aria-hidden="true">{w}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} aria-hidden="true" />)}
        {all.map((d) => {
          const can = open.has(d);
          const n = can && count ? count(d) : null;
          return (
            <label key={d} className={`cal-day${can ? '' : ' is-off'}`}>
              <input type="radio" name={name} value={d} checked={value === d} disabled={!can} onChange={() => onChange(d)}
                aria-label={`${fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}${can ? (n != null ? `, ${n} free` : '') : ', no free times'}`} />
              <b>{fmt(d, { day: 'numeric' })}</b>
              {n != null ? <small>{n} free</small> : can ? <i aria-hidden="true" /> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export const dayLong = (iso: string) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' });
export const dayShort = (iso: string) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' });
