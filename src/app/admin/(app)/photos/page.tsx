import { requireUser } from '@/lib/auth';
import { ensureSchema } from '@/lib/db';
import { photoOverrides } from '@/lib/content';
import { SITE_PHOTOS, isDecorative } from '@/lib/photos';
import { PhotoCard } from './PhotoCard';

export const metadata = { title: 'Photos' };

const GROUPS = [
  { h: 'Home page', test: (id: string) => id.startsWith('home-') },
  { h: 'Clinic pages', test: (id: string) => id.startsWith('clinic:') },
  { h: 'Clinic tiles', note: 'The photographed tiles that link to each clinic, on the home page and the Clinics page, and three of them under each clinic’s page.', test: (id: string) => id.startsWith('tile:') },
];

export default async function Photos() {
  await requireUser();
  await ensureSchema();
  const over = await photoOverrides();
  return (
    <div className="ad-page">
      <div className="ad-head">
        <div>
          <h1>Photos</h1>
          <p className="ad-muted">Replace the main photographs on the home page, on each clinic&rsquo;s page and on the clinic tiles. Wide (landscape) photographs work best. The photographs of each therapy are changed under <a href="/admin/treatments">Treatments</a>, and an article&rsquo;s under <a href="/admin/journal">Journal</a>.</p>
        </div>
      </div>
      {GROUPS.map((g) => (
        <section key={g.h} style={{ display: 'grid', gap: 14, marginBottom: 36 }}>
          <h2>{g.h}</h2>
          {g.note && <p className="ad-muted">{g.note}</p>}
          <div className="ad-cards ad-cards-wide">
            {SITE_PHOTOS.filter((p) => g.test(p.id)).map((p) => (
              <PhotoCard key={p.id} id={p.id} label={p.label} where={p.where} page={p.page}
                original={p.default} current={over[p.id] ?? null} decorative={isDecorative(p.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
