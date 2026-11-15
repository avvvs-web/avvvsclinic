'use client';

import { useState, useTransition } from 'react';
import type { Photo } from '@/lib/photos';
import { setSitePhoto, type FormState } from '../../actions';
import { Note } from '../../AdminForms';
import { ImagePicker } from '../../ImagePicker';

/** One of the site's photographs: what is shown now, a way to replace it, and a way back to the original. */
export function PhotoCard({ id, label, where, page, original, current, decorative = false }: {
  id: string; label: string; where: string; page: string; original: Photo; current: Photo | null; decorative?: boolean;
}) {
  const [live, setLive] = useState<Photo | null>(current);
  const [draft, setDraft] = useState<{ url: string; alt: string } | null>(null);
  const [msg, setMsg] = useState<FormState>({});
  const [pending, start] = useTransition();
  const shown = draft ? { src: draft.url, alt: draft.alt } : live ?? original;

  const save = () => start(async () => {
    const r = await setSitePhoto(id, draft);
    setMsg(r);
    if (!r.error && draft) { setLive({ src: draft.url, alt: draft.alt }); setDraft(null); }
  });
  const restore = () => {
    if (!confirm('Put back the original photograph?')) return;
    start(async () => { const r = await setSitePhoto(id, null); setMsg(r); if (!r.error) { setLive(null); setDraft(null); } });
  };

  return (
    <section className="ad-card">
      <div className="ad-card-top">
        <h2>{label}</h2>
        <a className="ad-link" href={page} target="_blank" rel="noopener">View</a>
      </div>
      <p className="ad-muted">{where}{live && !draft ? ' · replaced' : ''}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ad-thumb" src={shown.src} alt="" style={{ aspectRatio: '16 / 9', objectFit: 'cover', objectPosition: (!draft && !live && original.position) || '50% 50%' }} />
      <ImagePicker label={draft || live ? 'Choose another photograph' : 'Replace photograph'} onPicked={(url) => { setMsg({}); setDraft({ url, alt: '' }); }} />
      {draft && (
        <>
          {decorative
            ? <p className="ad-muted">This photograph is decoration behind the clinic&rsquo;s name, so it needs no description.</p>
            : <label className="ad-field"><span>Describe it for people who cannot see it</span>
                <input value={draft.alt} onChange={(e) => setDraft({ ...draft, alt: e.target.value })} placeholder="e.g. A doctor reading a patient’s pulse at the wrist" />
              </label>}
          <div className="ad-card-actions">
            <button type="button" className="ad-btn" disabled={pending} onClick={save}>{pending ? 'Saving…' : 'Save'}</button>
            <button type="button" className="ad-link" disabled={pending} onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </>
      )}
      {!draft && live && <button type="button" className="ad-link ad-danger" disabled={pending} onClick={restore}>Put back the original</button>}
      <Note s={msg} />
    </section>
  );
}
