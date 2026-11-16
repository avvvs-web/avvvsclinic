import { REVIVE, clinicBySlug, type Clinic, type QA } from './clinics';
import { REVIVE_IMAGE } from './photos';

/*
 * The wording of each clinic's page that can be changed in the admin (Clinics → Edit page text).
 * The text in clinics.ts is the default; a saved change is kept in clinic_meta under
 * `clinic_text:<slug>`, and "Go back to the original" deletes it.
 */

// Gloveda Revive shares the clinic page's shape.
export const REVIVE_PAGE: Clinic = {
  slug: REVIVE.slug, no: '07', name: REVIVE.name, label: 'Skin and hair', kicker: REVIVE.kicker,
  title: 'Healthy skin. Beautiful hair.', short: REVIVE.short, lede: REVIVE.lede, body: REVIVE.body,
  focus: [
    { h: 'Ayurvedic formulations', p: 'Traditional formulations from a pharmacy that has made Ayurveda medicines in Kozhikode since 1921.' },
    { h: 'Modern technologies', p: 'Modern skin and hair care technologies, such as Ayur-Medi infused hydra suction, microdermabrasion, microneedling, meso-electroporation and LED light therapy, alongside the formulations.' },
    { h: 'Treatments', p: 'Eight signature Ayur-Medi facials, hair care therapies for hair fall, dandruff and thinning, and eye and foot care. Treatment plans are chosen after a consultation.' },
  ],
  therapies: REVIVE.therapies,
  image: REVIVE_IMAGE,
  faq: [
    { q: 'What is Gloveda Revive?', a: REVIVE.short },
    { q: 'What does Gloveda Revive treat?', a: 'A wide range of skin and hair concerns, combining traditional Ayurvedic formulations with modern skin and hair care technologies: facials for glow, acne, tanning, hydration, contouring and signs of ageing; treatments for hair fall, dandruff, hair thinning and early-stage baldness; and eye and foot care. Treatment plans are chosen after a consultation.' },
    { q: 'Where is Gloveda Revive?', a: 'At AVVVS Ayur Speciality Clinic, 3rd floor, Kaloor Central, Annie Hall Road, opposite Kozhikode Railway Station, Kozhikode 673002.' },
  ],
};

export const clinicPage = (slug: string): Clinic | undefined => (slug === REVIVE.slug ? REVIVE_PAGE : clinicBySlug(slug));

/** What the clinic's tile says, where it differs from the page's introduction. */
const TILE_TEXT: Record<string, string> = {
  [REVIVE.slug]: 'Ayur-Medi care for healthy skin and beautiful hair.',
  'obesity-lifestyle-clinic': 'Healthy weight, and care for lifestyle and metabolic disorders.',
};

export interface ClinicText {
  /** the line under the clinic's name */
  title: string;
  /** one sentence, quotable on its own: what this clinic is */
  short: string;
  lede: string;
  body: string[];
  focus: { h: string; p: string }[];
  faq: QA[];
  /** the sentence on the clinic's tile */
  tile: string;
}

export function defaultClinicText(slug: string): ClinicText | undefined {
  const c = clinicPage(slug);
  if (!c) return undefined;
  return { title: c.title, short: c.short, lede: c.lede, body: c.body, focus: c.focus, faq: c.faq, tile: TILE_TEXT[slug] ?? c.lede };
}

/** Keeps only well-formed text (input from the editor is untrusted); empty parts fall back to the original. */
export function cleanClinicText(input: unknown, slug: string): ClinicText | null {
  const def = defaultClinicText(slug);
  if (!def || !input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v : []).slice(0, 20).map((x) => s(x, max)).filter(Boolean);
  const pairs = <A extends string, B extends string>(v: unknown, a: A, b: B, maxA: number, maxB: number) =>
    (Array.isArray(v) ? v : []).slice(0, 30).map((x) => {
      const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      return { [a]: s(r[a], maxA), [b]: s(r[b], maxB) } as Record<A | B, string>;
    }).filter((x) => x[a] && x[b]);
  return {
    title: s(o.title, 200) || def.title,
    short: s(o.short, 600) || def.short,
    lede: s(o.lede, 1000),
    body: list(o.body, 2000),
    focus: pairs(o.focus, 'h', 'p', 120, 600),
    faq: pairs(o.faq, 'q', 'a', 300, 2000),
    tile: s(o.tile, 200) || def.tile,
  };
}
