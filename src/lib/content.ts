import 'server-only';
import { ensureSchema, hasDatabase, sql } from './db';
import { CLINICS, REVIVE } from './clinics';
import { POSTS as BUILT_IN_POSTS, type Block, type Post } from './journal';
import type { Clinic, QA } from './clinics';
import { clinicPage, cleanClinicText, type ClinicText } from './clinicPages';
import { THERAPIES as BUILT_IN_THERAPIES, type Therapy } from './therapies';
import { DOCTORS as BUILT_IN_DOCTORS, doctorPhoto } from './site';
import { sitePhotoDef, type Photo } from './photos';

/*
 * What the public pages read. Each list is the built-in content (in code, reviewed with the site)
 * merged with what has been published in the admin. If the database cannot be reached, the pages
 * fall back to the built-in content rather than failing.
 */

export const CLINIC_SLUGS = [...CLINICS.map((c) => c.slug), REVIVE.slug];
export const clinicName = (slug: string) => (slug === REVIVE.slug ? REVIVE.name : CLINICS.find((c) => c.slug === slug)?.name ?? slug);

export const POST_KINDS = ['Visiting the clinic', 'Therapies', 'Clinic notes', 'Wellness'] as const;

const FALLBACK_IMAGE = '/photos/herbs.jpg';

// ---------- rows ----------

export interface TreatmentRow {
  id: number; slug: string; name: string; ml: string; what: string; how: string;
  image_url: string | null; image_alt: string; clinics: string[]; status: 'draft' | 'published'; sort: number;
  /** the admin's edit of a built-in therapy with the same slug */
  builtin_edit?: boolean;
  created_at: string; updated_at: string;
}

export interface PostRow {
  id: number; slug: string; title: string; dek: string; answer: string; kind: string;
  cover_url: string | null; cover_alt: string; body: unknown; clinic: string | null; treatments: string[];
  status: 'draft' | 'published'; author_id: number | null; author_name?: string | null; reviewer?: string | null;
  faq?: unknown;
  /** the admin's edit of a built-in article with the same slug */
  builtin_edit?: boolean;
  published_at: string | null; created_at: string; updated_at: string;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? ''));
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.replace(/^\{|\}$/g, '').split(',').filter(Boolean) : []);

// ---------- blocks written in the admin ----------

/** Keeps only well-formed blocks with the expected fields (input from the editor is untrusted). */
export function cleanBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) return [];
  const s = (v: unknown, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '');
  const out: Block[] = [];
  for (const b of input.slice(0, 300)) {
    if (!b || typeof b !== 'object') continue;
    const o = b as Record<string, unknown>;
    switch (o.t) {
      case 'p': case 'h2': case 'quote': out.push({ t: o.t, text: s(o.text) }); break;
      case 'ul': out.push({ t: 'ul', items: (Array.isArray(o.items) ? o.items : []).slice(0, 60).map((x) => s(x, 1000)) }); break;
      case 'ol': out.push({ t: 'ol', items: (Array.isArray(o.items) ? o.items : []).slice(0, 40).map((x) => {
        const i = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
        return { h: s(i.h, 200), p: s(i.p, 2000) };
      }) }); break;
      case 'note': out.push({ t: 'note', h: s(o.h, 200), text: s(o.text, 2000) }); break;
      case 'img': {
        const url = s(o.url, 1000);
        if (safeImage(url)) out.push({ t: 'img', url, alt: s(o.alt, 300), caption: s(o.caption, 300) });
        break;
      }
    }
  }
  return out;
}

/** Keeps only question-and-answer pairs with both parts (input from the editor is untrusted). */
export function cleanFaq(input: unknown, max = 30): QA[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, max).map((x) => {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    return { q: typeof o.q === 'string' ? o.q.trim().slice(0, 300) : '', a: typeof o.a === 'string' ? o.a.trim().slice(0, 2000) : '' };
  }).filter((x) => x.q && x.a);
}

/** Images the site will show: Vercel Blob uploads, local development uploads, and the site's own photos. */
export const safeImage = (url: string) =>
  /^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i.test(url) || /^\/(uploads|photos|doctors)\/[\w./-]+$/.test(url);

const wordCount = (blocks: Block[], extra: string) =>
  `${extra} ${blocks.map((b) => ('text' in b ? b.text : 'items' in b ? (b.items as unknown[]).map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' ? `${(x as { h?: string }).h ?? ''} ${(x as { p?: string }).p ?? ''}` : '')).join(' ') : '')).join(' ')}`
    .split(/\s+/).filter(Boolean).length;

// ---------- mapping ----------

export function toTherapy(r: TreatmentRow): Therapy {
  return {
    slug: r.slug, name: r.name, ml: r.ml, what: r.what, how: r.how,
    img: r.image_url && safeImage(r.image_url) ? r.image_url : FALLBACK_IMAGE,
    clinics: arr(r.clinics).filter((c) => CLINIC_SLUGS.includes(c)), fromAdmin: true,
  };
}

export function toPost(r: PostRow): Post {
  const blocks = cleanBlocks(r.body);
  const faq = cleanFaq(r.faq);
  // an edited built-in article keeps its framing of an unchanged cover
  const orig = r.builtin_edit ? BUILT_IN_POSTS.find((p) => p.slug === r.slug) : undefined;
  return {
    ...(faq.length ? { faq } : {}),
    slug: r.slug, title: r.title, dek: r.dek, kind: r.kind, answer: r.answer || r.dek,
    published: iso(r.published_at ?? r.created_at).slice(0, 10), revised: iso(r.updated_at).slice(0, 10),
    minutes: Math.max(1, Math.round(wordCount(blocks, `${r.dek} ${r.answer}`) / 200)),
    cover: { src: r.cover_url && safeImage(r.cover_url) ? r.cover_url : FALLBACK_IMAGE, alt: r.cover_alt || '', position: orig && orig.cover.src === r.cover_url ? orig.cover.position : '50% 50%' },
    blocks, clinic: r.clinic && CLINIC_SLUGS.includes(r.clinic) ? r.clinic : undefined,
    treatments: arr(r.treatments), fromAdmin: true, reviewer: r.reviewer || undefined,
  };
}

async function rows<T>(fn: () => Promise<unknown[]>): Promise<T[]> {
  if (!hasDatabase()) return [];
  try { await ensureSchema(); return (await fn()) as T[]; }
  catch (e) { console.error('[content] could not read the database', e); return []; }
}

// ---------- therapies ----------

/** The clinics each built-in therapy belongs to, as written in the code. */
export const defaultBuiltInClinics = (slug: string) =>
  [...CLINICS.filter((c) => c.therapies.includes(slug)).map((c) => c.slug), ...(REVIVE.therapies.includes(slug) ? [REVIVE.slug] : [])];

/** The same, with any change made in the admin's Clinics page applied. */
export async function builtInClinics(): Promise<Record<string, string[]>> {
  const over = await rows<{ slug: string; clinics: unknown }>(() => sql()`SELECT slug, clinics FROM clinic_builtin_links`);
  const map = Object.fromEntries(BUILT_IN_THERAPIES.map((t) => [t.slug, defaultBuiltInClinics(t.slug)]));
  for (const o of over) if (o.slug in map) map[o.slug] = arr(o.clinics).filter((c) => CLINIC_SLUGS.includes(c));
  return map;
}

/**
 * Every published therapy, built-in first (in the clinic's own order), then those added in the admin.
 * A built-in therapy edited in the admin is a clinic_treatments row with the same slug: once published,
 * its wording and photograph replace the code's, while its place and its clinics stay as they were.
 */
export async function getTherapies(): Promise<Therapy[]> {
  const links = await builtInClinics();
  const rowsAll = await rows<TreatmentRow>(() => sql()`SELECT * FROM clinic_treatments WHERE status = 'published' ORDER BY sort, name`);
  const edits = new Map(rowsAll.filter((r) => r.builtin_edit).map((r) => [r.slug, r]));
  const builtIn = BUILT_IN_THERAPIES.map((t) => {
    const e = edits.get(t.slug);
    if (!e) return { ...t, clinics: links[t.slug] };
    const img = e.image_url && safeImage(e.image_url) ? e.image_url : undefined;
    return { ...t, name: e.name, ml: e.ml, what: e.what, how: e.how, img, pos: img === t.img ? t.pos : undefined, clinics: links[t.slug] };
  });
  const taken = new Set(builtIn.map((t) => t.slug));
  return [...builtIn, ...rowsAll.filter((r) => !taken.has(r.slug)).map(toTherapy)];
}

export async function getTherapy(slug: string): Promise<Therapy | undefined> {
  return (await getTherapies()).find((t) => t.slug === slug);
}

/** The therapies a clinic offers: its own list, plus any treatment the admin linked to it. */
export async function therapiesForClinic(slug: string): Promise<Therapy[]> {
  return (await getTherapies()).filter((t) => t.clinics?.includes(slug));
}

// ---------- journal ----------

/**
 * Every published article: the newest written in the admin first, then the built-in ones. A built-in
 * article edited in the admin keeps its place, with the published edit in place of the code's text.
 */
export async function getPosts(): Promise<Post[]> {
  const all = await rows<PostRow>(() => sql()`SELECT * FROM clinic_posts WHERE status = 'published' ORDER BY published_at DESC NULLS LAST, id DESC`);
  const builtIn = new Set(BUILT_IN_POSTS.map((p) => p.slug));
  const edits = new Map(all.filter((r) => r.builtin_edit).map((r) => [r.slug, r]));
  const own = all.filter((r) => !r.builtin_edit && !builtIn.has(r.slug)).map(toPost);
  return [...own, ...BUILT_IN_POSTS.map((p) => { const e = edits.get(p.slug); return e ? toPost(e) : p; })];
}

export async function getPost(slug: string): Promise<Post | undefined> {
  const builtIn = BUILT_IN_POSTS.find((p) => p.slug === slug);
  const db = await rows<PostRow>(() => sql()`SELECT * FROM clinic_posts WHERE slug = ${slug} AND status = 'published' LIMIT 1`);
  if (db[0] && (!builtIn || db[0].builtin_edit)) return toPost(db[0]);
  return builtIn;
}

export async function postsForClinic(slug: string) {
  return (await getPosts()).filter((p) => p.clinic === slug);
}

export async function postsForTherapy(slug: string) {
  return (await getPosts()).filter((p) => p.treatments?.includes(slug));
}

// ---------- doctors ----------

export interface Doctor { slug: string; name: string; quals: string[]; role?: string; photo: string | null }

export interface DoctorRow {
  id: number; slug: string; name: string; quals: string[]; role: string; photo_url: string | null;
  sort: number; visible: boolean; created_at: string; updated_at: string;
}

/** The doctors shown on the site, in the admin's order; the launch list when there is no database. */
export async function getDoctors(): Promise<Doctor[]> {
  if (!hasDatabase()) return BUILT_IN_DOCTORS.map((d) => ({ ...d, photo: doctorPhoto(d) }));
  const db = await rows<DoctorRow>(() => sql()`SELECT * FROM clinic_doctors WHERE visible ORDER BY sort, name`);
  return db.map((d) => ({
    slug: d.slug, name: d.name, quals: arr(d.quals), role: d.role || undefined,
    photo: d.photo_url && safeImage(d.photo_url) ? d.photo_url : null,
  }));
}

export async function getDoctor(slug: string): Promise<Doctor | undefined> {
  return (await getDoctors()).find((d) => d.slug === slug);
}

// ---------- photographs changed in the admin ----------

/** Every replaced photograph, by id. */
export async function photoOverrides(): Promise<Record<string, Photo>> {
  const r = await rows<{ key: string; value: string }>(() => sql()`SELECT key, value FROM clinic_meta WHERE key LIKE 'photo:%'`);
  const out: Record<string, Photo> = {};
  for (const { key, value } of r) {
    try {
      const p = JSON.parse(value) as Photo;
      if (p && typeof p.src === 'string' && safeImage(p.src)) out[key.slice(6)] = { src: p.src, alt: String(p.alt ?? ''), position: p.position || '50% 50%' };
    } catch { /* ignore a broken entry and use the built-in photograph */ }
  }
  return out;
}

/** The photograph to show for one of the site's changeable photographs (see lib/photos). */
export async function sitePhoto(id: string): Promise<Photo> {
  const def = sitePhotoDef(id);
  const over = (await photoOverrides())[id];
  return over ?? def?.default ?? { src: FALLBACK_IMAGE, alt: '' };
}

// ---------- clinic page text changed in the admin ----------

export async function clinicTextOverrides(): Promise<Record<string, ClinicText>> {
  const r = await rows<{ key: string; value: string }>(() => sql()`SELECT key, value FROM clinic_meta WHERE key LIKE 'clinic_text:%'`);
  const out: Record<string, ClinicText> = {};
  for (const { key, value } of r) {
    const slug = key.slice('clinic_text:'.length);
    try { const t = cleanClinicText(JSON.parse(value), slug); if (t) out[slug] = t; } catch { /* use the original */ }
  }
  return out;
}

/** A clinic's page as the public sees it: the code's page with any wording changed in the admin. */
export async function getClinicPage(slug: string): Promise<Clinic | undefined> {
  const c = clinicPage(slug);
  if (!c) return undefined;
  const t = (await clinicTextOverrides())[slug];
  return t ? { ...c, title: t.title, short: t.short, lede: t.lede, body: t.body, focus: t.focus, faq: t.faq } : c;
}

// ---------- online booking ----------

/** The admin's master switch for online consultations. On unless switched off. */
export async function onlineBookingOn(): Promise<boolean> {
  const r = await rows<{ value: string }>(() => sql()`SELECT value FROM clinic_meta WHERE key = 'online_booking'`);
  return r[0]?.value !== 'off';
}

export const builtInPostSlugs =() => new Set(BUILT_IN_POSTS.map((p) => p.slug));
export const builtInTherapySlugs = () => new Set(BUILT_IN_THERAPIES.map((t) => t.slug));
