import { CLINICS, REVIVE } from './clinics';

/*
 * The site's photographs that can be changed in the admin (Photos). Each has the photograph built
 * into the site as its default; a replacement chosen in the admin is kept in clinic_meta under
 * `photo:<id>`, and deleting it brings the default back.
 */

export interface Photo { src: string; alt: string; position?: string }

export const REVIVE_IMAGE: Photo = {
  src: '/photos/revive.jpg',
  alt: 'A therapist applying a turmeric face pack with a skin-care device as a woman rests on a treatment bed',
  position: '40% 50%',
};

export interface SitePhoto { id: string; label: string; where: string; page: string; default: Photo }

/** The clinics as photographed tiles of three sizes, on the home page (and three of them under each clinic). */
export const TILES: { slug: string; size: 'wide' | 'half' | 'third' | 'full'; photo: Photo }[] = [
  { slug: 'pain-management-clinic', size: 'wide', photo: { src: '/photos/pain.jpg', alt: '', position: '45% 45%' } },
  { slug: 'pregnancy-postnatal-care-clinic', size: 'third', photo: { src: '/photos/mother.jpg', alt: '', position: '50% 35%' } },
  { slug: 'headache-clinic', size: 'third', photo: { src: '/photos/headache.jpg', alt: '', position: '42% 40%' } },
  { slug: 'obesity-lifestyle-clinic', size: 'third', photo: { src: '/photos/lifestyle.jpg', alt: '', position: '30% 50%' } },
  { slug: 'infertility-clinic', size: 'third', photo: { src: '/photos/infertility.jpg', alt: '', position: '62% 50%' } },
  { slug: REVIVE.slug, size: 'full', photo: { src: '/photos/revive.jpg', alt: '', position: '40% 45%' } },
];

const nameOf = (slug: string) => (slug === REVIVE.slug ? REVIVE.name : CLINICS.find((c) => c.slug === slug)?.name ?? slug);

export const SITE_PHOTOS: SitePhoto[] = [
  { id: 'home-hero', label: 'Opening photograph', where: 'Home page, behind the title', page: '/',
    default: { src: '/photos/shirodhara.jpg', alt: 'Warm oil streaming from a brass vessel onto the forehead during Shirodhara', position: '12% 50%' } },
  { id: 'home-doctor', label: 'Doctor photograph', where: 'Home page, beside “Ayurveda and modern medicine, in one room.”', page: '/',
    default: { src: '/photos/pulse.jpg', alt: 'A doctor reading a patient’s pulse at the wrist', position: '58% 50%' } },
  ...CLINICS.map((c) => ({ id: `clinic:${c.slug}`, label: c.name, where: 'Clinic page, under the title', page: `/clinics/${c.slug}`, default: c.image })),
  { id: `clinic:${REVIVE.slug}`, label: REVIVE.name, where: 'Clinic page, under the title', page: `/clinics/${REVIVE.slug}`, default: REVIVE_IMAGE },
  // the tiles are decorative links (the clinic's name is their text), so they need no description
  ...TILES.map((t) => ({ id: `tile:${t.slug}`, label: nameOf(t.slug), where: 'Home page, in the clinic tiles (and under the other clinics’ pages)', page: '/', default: t.photo })),
];

/** Photographs that are decoration only, shown with an empty description. */
export const isDecorative = (id: string) => id.startsWith('tile:');

export const sitePhotoDef = (id: string) => SITE_PHOTOS.find((p) => p.id === id);
