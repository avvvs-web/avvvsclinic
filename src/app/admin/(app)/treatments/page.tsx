import Link from 'next/link';
import { sql, ensureSchema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { builtInClinics, clinicName, type TreatmentRow } from '@/lib/content';
import { THERAPIES } from '@/lib/therapies';
import { editBuiltInTherapy, newTreatment } from '../../actions';

export const metadata = { title: 'Treatments' };

const draftName = (r: TreatmentRow) => (r.slug.startsWith('draft-') && r.name === 'Untitled treatment' ? 'Untitled treatment' : r.name);

export default async function Treatments() {
  await requireUser();
  await ensureSchema();
  const all = (await sql()`SELECT * FROM clinic_treatments ORDER BY status DESC, sort, updated_at DESC`) as unknown as TreatmentRow[];
  const builtIn = new Set(THERAPIES.map((t) => t.slug));
  const rows = all.filter((r) => !r.builtin_edit);
  const edits = new Map(all.filter((r) => r.builtin_edit).map((r) => [r.slug, r]));
  const links = await builtInClinics();
  return (
    <div className="ad-page">
      <div className="ad-head">
        <div>
          <h1>Treatments</h1>
          <p className="ad-muted">Each treatment appears on the therapies page and on every clinic it is linked to.</p>
        </div>
        <form action={newTreatment}><button className="ad-btn">New treatment</button></form>
      </div>

      {rows.length === 0 ? (
        <p className="ad-empty">No treatments added here yet. Start with <b>New treatment</b>.</p>
      ) : (
        <table className="ad-table">
          <thead><tr><th>Treatment</th><th>Clinics</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{draftName(r)}</b>{r.ml && <span className="ad-muted" lang="ml"> {r.ml}</span>}</td>
                <td className="ad-muted">{(r.clinics ?? []).map(clinicName).join(', ') || 'Not linked yet'}</td>
                <td>{builtIn.has(r.slug)
                  ? <span className="ad-muted">Not shown: the built-in {r.name} below uses this address. Edit that one instead.</span>
                  : <span className={`ad-pill ad-pill-${r.status}`}>{r.status === 'published' ? 'Published' : 'Draft'}</span>}</td>
                <td className="ad-row-actions">
                  <Link href={`/admin/treatments/${r.id}`}>Edit</Link>
                  {r.status === 'published' && <a href={`/therapies#${r.slug}`} target="_blank" rel="noopener">View</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section className="ad-builtin">
        <h2>Built into the site</h2>
        <p className="ad-muted">Edit one to change its name, wording or photograph; the site keeps showing the original until you publish. Which clinics they appear under is set on the <Link href="/admin/clinics">Clinics</Link> page.</p>
        <table className="ad-table">
          <thead><tr><th>Therapy</th><th>Clinics</th><th>Wording</th><th /></tr></thead>
          <tbody>
            {THERAPIES.map((t) => {
              const e = edits.get(t.slug);
              return (
                <tr key={t.slug}>
                  <td><b>{e?.status === 'published' ? e.name : t.name}</b></td>
                  <td className="ad-muted">{(links[t.slug] ?? []).map(clinicName).join(', ') || 'Not shown under any clinic'}</td>
                  <td>{!e ? <span className="ad-muted">Original</span> : e.status === 'published' ? <span className="ad-pill ad-pill-published">Edited</span> : <span className="ad-pill ad-pill-draft">Edit in draft</span>}</td>
                  <td className="ad-row-actions">
                    <form action={editBuiltInTherapy.bind(null, t.slug)}><button className="ad-link">Edit</button></form>
                    <a href={`/therapies/${t.slug}`} target="_blank" rel="noopener">View</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
