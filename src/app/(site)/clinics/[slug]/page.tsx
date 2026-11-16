import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Chevron, Close, Crumbs, Faq, JsonLd } from '@/components/Parts';
import { ClinicTiles, Journal } from '@/components/Sections';
import { getClinicPage, postsForClinic, sitePhoto, therapiesForClinic } from '@/lib/content';
import { CLINICS, REVIVE } from '@/lib/clinics';
import { CONDITIONS, breadcrumbLd, medicalPageLd } from '@/lib/ld';
import { DOCTOR, alternatesFor } from '@/lib/site';


export const dynamicParams = false;
export const revalidate = 300;
export function generateStaticParams() { return [...CLINICS.map((c) => ({ slug: c.slug })), { slug: REVIVE.slug }]; }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await getClinicPage((await params).slug);
  if (!c) return {};
  const title = c.slug === REVIVE.slug ? 'Gloveda Revive: Ayur-Medi Cosmetic Clinic for skin and hair' : `${c.name} in Kozhikode (Calicut)`;
  return { title, description: c.short, alternates: alternatesFor(`/clinics/${c.slug}`), openGraph: { url: `/clinics/${c.slug}`, title: `${title} · AVVVS`, description: c.short } };
}

export default async function ClinicPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = await getClinicPage((await params).slug);
  if (!c) notFound();
  const [therapies, reading, pic] = await Promise.all([therapiesForClinic(c.slug), postsForClinic(c.slug), sitePhoto(`clinic:${c.slug}`)]);

  return (
    <main id="main">
      <section className="page-head">
        <div className="in-narrow">
          <Crumbs trail={[{ name: 'Clinics', href: '/clinics' }, { name: c.name }]} />
          <h1 className="t-1" data-reveal data-now>{c.name}</h1>
          <p className="lede" data-reveal data-now data-delay="120">{c.title}</p>
          <div className="actions" data-reveal data-now data-delay="220">
            <Link className="btn" href={`/book?care=${c.slug}`}>Book a consultation</Link>
          </div>
        </div>
      </section>

      <div className="page-pic" data-reveal data-now data-delay="300">
        <figure><Image src={pic.src} alt={pic.alt} width={2400} height={1030} priority sizes="(min-width: 1440px) 1440px, 100vw" style={{ objectPosition: pic.position }} /></figure>
      </div>

      <section className="sec" aria-label={`About the ${c.name}`}>
        <div className="prose" data-reveal>
          <p className="first" data-answer>{c.short}</p>
          {c.lede && <p>{c.lede}</p>}
          {c.body.map((b, i) => <p key={i}>{b}</p>)}
          {c.slug === 'pain-management-clinic' && <p className="doctor"><b>{DOCTOR.name}</b><span>{DOCTOR.qualifications.join(' · ')}</span></p>}
        </div>
      </section>

      <section className="sec mist" aria-labelledby="care-title">
        <div className="in center head"><h2 id="care-title" className="t-2" data-reveal>{c.slug === 'headache-clinic' ? 'The headaches we see.' : 'What care looks like.'}</h2></div>
        <ul className="cols3" data-stagger>
          {c.focus.map((f, i) => <li key={i}><h3>{f.h}</h3><p>{f.p}</p></li>)}
        </ul>
        {therapies.length > 0 && (
          <div style={{ marginTop: 'clamp(56px, 7vw, 88px)', display: 'grid', gap: 18, justifyItems: 'center' }} data-reveal>
            <p className="small">Therapies the doctor may recommend</p>
            <ul className="pills">
              {therapies.map((t) => <li key={t.slug}><Link href={`/therapies/${t.slug}`}>{t.name} <small lang="ml">{t.ml}</small></Link></li>)}
            </ul>
          </div>
        )}
      </section>

      <Faq title="Questions, answered." items={c.faq} />

      {reading.length > 0 && <Journal only={reading} title="Reading for this clinic" tone="" />}

      <section className="sec mist" aria-labelledby="others-title">
        <div className="in center head">
          <h2 id="others-title" className="t-2" data-reveal>Other clinics.</h2>
        </div>
        <ClinicTiles exclude={c.slug} />
        <p className="after-tiles" data-reveal><Link className="btn btn-lg" href="/clinics">See all clinics<Chevron /></Link></p>
      </section>

      <Close care={c.slug} />
      <JsonLd data={breadcrumbLd([{ name: 'Speciality clinics', path: '/clinics' }, { name: c.name, path: `/clinics/${c.slug}` }])} />
      <JsonLd data={medicalPageLd({ path: `/clinics/${c.slug}`, name: `${c.name}, Kozhikode`, description: c.short, conditions: CONDITIONS[c.slug] })} />
    </main>
  );
}
