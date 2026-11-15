'use client';

/**
 * A list of two-part items (a question and its answer, a heading and its text), each with its own
 * remove and reorder buttons, and a button to add one. Used for FAQs, numbered steps and the
 * "What care looks like" points on a clinic's page.
 */
export function PairsEditor<K extends string>({ items, onChange, keys, labels, add, short = false }: {
  items: Record<K, string>[];
  onChange: (items: Record<K, string>[]) => void;
  /** the two fields of each item, e.g. ['q', 'a'] */
  keys: [K, K];
  /** placeholders for the two fields */
  labels: [string, string];
  /** the add button's text */
  add: string;
  /** a single line for the first field (a heading), not a box */
  short?: boolean;
}) {
  const [a, b] = keys;
  const set = (i: number, k: K, v: string) => onChange(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="ad-pairs">
      {items.map((it, i) => (
        <div key={i} className="ad-pair">
          <div className="ad-block-head">
            <span>{i + 1}</span>
            <span className="ad-block-tools">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}>Up</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1}>Down</button>
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}>Remove</button>
            </span>
          </div>
          {short
            ? <input value={it[a]} placeholder={labels[0]} onChange={(e) => set(i, a, e.target.value)} />
            : <textarea rows={2} value={it[a]} placeholder={labels[0]} onChange={(e) => set(i, a, e.target.value)} />}
          <textarea rows={3} value={it[b]} placeholder={labels[1]} onChange={(e) => set(i, b, e.target.value)} />
        </div>
      ))}
      <button type="button" className="ad-link" onClick={() => onChange([...items, { [a]: '', [b]: '' } as Record<K, string>])}>{add}</button>
    </div>
  );
}
