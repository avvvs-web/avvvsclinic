'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { checkClaims } from '@/lib/claims';
import type { ClinicText } from '@/lib/clinicPages';
import { resetClinicText, saveClinicText, type FormState } from '../../../actions';
import { Note } from '../../../AdminForms';
import { PairsEditor } from '../../../PairsEditor';

/** The wording of one clinic's page, in the order it appears on the page. */
export function ClinicTextEditor({ slug, name, initial, edited: startEdited }: { slug: string; name: string; initial: ClinicText; edited: boolean }) {
  const [d, setD] = useState<ClinicText>(initial);
  const [edited, setEdited] = useState(startEdited);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<FormState>({});
  const [pending, start] = useTransition();
  const up = (patch: Partial<ClinicText>) => { setD((x) => ({ ...x, ...patch })); setDirty(true); setMsg({}); };

  const claims = useMemo(() => checkClaims([
    { where: 'the line under the name', text: d.title }, { where: 'the summary', text: d.short }, { where: 'the introduction', text: d.lede },
    ...d.body.map((t, i) => ({ where: `paragraph ${i + 1}`, text: t })),
    ...d.focus.map((f, i) => ({ where: `care point ${i + 1}`, text: `${f.h} ${f.p}` })),
    ...d.faq.map((f, i) => ({ where: `question ${i + 1}`, text: `${f.q} ${f.a}` })),
    { where: 'the tile', text: d.tile },
  ]), [d]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = () => start(async () => {
    const r = await saveClinicText(slug, d);
    setMsg(r);
    if (!r.error) { setDirty(false); setEdited(true); }
  });
  const reset = () => {
    if (!confirm('Throw away your changes and go back to the original wording of this page?')) return;
    start(async () => { const r = await resetClinicText(slug); setMsg(r); if (!r.error) location.reload(); });
  };

  return (
    <div className="ad-page ad-editor">
      <div className="ad-toolbar">
        <div className="ad-state">
          <Link href="/admin/clinics" className="ad-link">Clinics</Link>
          <span className={`ad-pill ad-pill-${edited ? 'published' : 'draft'}`}>{edited ? 'Edited' : 'Original'}</span>
          <span className="ad-muted">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        </div>
        <div className="ad-actions">
          <a className="ad-btn ad-btn-quiet" href={`/clinics/${slug}`} target="_blank" rel="noopener">View page</a>
          <button type="button" className="ad-btn" disabled={pending || !dirty} onClick={save}>{pending ? 'Saving…' : 'Save and publish'}</button>
        </div>
      </div>
      <Note s={msg} />

      <div className="ad-two">
        <div className="ad-stack">
          <h1 style={{ margin: 0 }}>{name}</h1>
          <p className="ad-muted" style={{ marginTop: -8 }}>The clinic&rsquo;s name is used across the site, in menus and in the booking form, so a developer changes it. Its photograph is on the <Link href="/admin/photos">Photos</Link> page, and its therapies on <Link href="/admin/clinics">Clinics</Link>.</p>

          <label className="ad-field"><span>Line under the name</span><input value={d.title} onChange={(e) => up({ title: e.target.value })} /></label>
          <label className="ad-field"><span>Summary</span>
            <textarea rows={3} value={d.short} onChange={(e) => up({ short: e.target.value })} />
            <small className="ad-muted">One sentence that says what the clinic is. It opens the page, and search engines and AI answers quote it.</small>
          </label>
          <label className="ad-field"><span>Introduction <em>(optional)</em></span><textarea rows={3} value={d.lede} onChange={(e) => up({ lede: e.target.value })} /></label>

          <fieldset className="ad-fieldset">
            <legend className="ad-field"><span>More about the clinic</span></legend>
            {d.body.map((t, i) => (
              <div key={i} className="ad-pair">
                <div className="ad-block-head"><span>Paragraph {i + 1}</span><span className="ad-block-tools"><button type="button" onClick={() => up({ body: d.body.filter((_, j) => j !== i) })}>Remove</button></span></div>
                <textarea rows={3} value={t} onChange={(e) => up({ body: d.body.map((x, j) => (j === i ? e.target.value : x)) })} />
              </div>
            ))}
            <button type="button" className="ad-link" style={{ justifySelf: 'start' }} onClick={() => up({ body: [...d.body, ''] })}>Add a paragraph</button>
          </fieldset>

          <fieldset className="ad-fieldset">
            <legend className="ad-field"><span>What care looks like</span></legend>
            <p className="ad-muted">Three points read best, side by side on a computer.</p>
            <PairsEditor items={d.focus} keys={['h', 'p']} labels={['Heading', 'A sentence or two. For a list, put each point on its own line after the first.']} add="Add a point" short onChange={(focus) => up({ focus })} />
          </fieldset>

          <fieldset className="ad-fieldset">
            <legend className="ad-field"><span>Questions, answered</span></legend>
            <p className="ad-muted">Shown near the end of the page and given to search engines as an FAQ.</p>
            <PairsEditor items={d.faq} keys={['q', 'a']} labels={['A question patients ask', 'The answer']} add="Add a question" short onChange={(faq) => up({ faq })} />
          </fieldset>

          <label className="ad-field"><span>Text on the clinic&rsquo;s tile</span>
            <input value={d.tile} onChange={(e) => up({ tile: e.target.value })} />
            <small className="ad-muted">The short line under the clinic&rsquo;s name on its photographed tile, on the home page and the Clinics page.</small>
          </label>
        </div>

        <aside className="ad-stack">
          <div className="ad-card">
            <h2>Before you save</h2>
            {claims.length === 0
              ? <p className="ad-muted">No claim wording found. Read it once more for anything that promises a health result.</p>
              : <ul className="ad-list">{claims.map((c, k) => <li key={k}><b>&ldquo;{c.word}&rdquo;</b> in {c.where}: {c.why}. The clinic makes no outcome claims; consider rewording.</li>)}</ul>}
            <p className="ad-muted">Saving publishes the change. The page updates within a few minutes.</p>
          </div>
          {edited && <button type="button" className="ad-link ad-danger" disabled={pending} onClick={reset}>Go back to the original</button>}
        </aside>
      </div>
    </div>
  );
}
