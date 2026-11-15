'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { sql, ensureSchema } from '@/lib/db';
import {
  createSession, endSession, hashPassword, verifyPassword, passwordProblem, requireUser, requireAdmin, tooManyAttempts, userCount,
} from '@/lib/auth';
import { CLINIC_SLUGS, POST_KINDS, builtInClinics, builtInPostSlugs, builtInTherapySlugs, cleanBlocks, cleanFaq, safeImage } from '@/lib/content';
import { slugify } from '@/lib/claims';
import { THERAPIES } from '@/lib/therapies';
import { POSTS as BUILT_IN_POSTS } from '@/lib/journal';
import { isDecorative, sitePhotoDef } from '@/lib/photos';
import { cleanClinicText } from '@/lib/clinicPages';
import { pingIndexNow } from '@/lib/indexnow';

export interface FormState { error?: string; ok?: string }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (f: FormData, k: string, max = 300) => String(f.get(k) ?? '').trim().slice(0, max);
const clientIp = async () => (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';

/** Every public page that lists treatments or articles. */
function refreshSite(extra: string[] = []) {
  for (const p of ['/', '/therapies', '/clinics', '/journal', '/doctors', '/sitemap.xml', '/llms.txt', '/llms-full.txt', '/journal/rss.xml', ...extra]) revalidatePath(p);
  for (const r of ['/clinics/[slug]', '/journal/[slug]', '/therapies/[slug]', '/doctors/[slug]']) revalidatePath(r, 'page');
}

// ---------- signing in ----------

export async function login(_: FormState, f: FormData): Promise<FormState> {
  const email = str(f, 'email').toLowerCase();
  const password = String(f.get('password') ?? '');
  if (tooManyAttempts(`ip:${await clientIp()}`) || tooManyAttempts(`email:${email}`)) return { error: 'Too many attempts. Wait a minute and try again.' };
  await ensureSchema();
  const u = (await sql()`SELECT id, password_hash, disabled FROM clinic_users WHERE email = ${email} LIMIT 1`)[0] as { id: number; password_hash: string; disabled: boolean } | undefined;
  // the same message either way, so the form does not reveal which emails have accounts
  if (!u || u.disabled || !(await verifyPassword(password, u.password_hash))) return { error: 'That email and password do not match an active account.' };
  await createSession(u.id);
  redirect('/admin');
}

export async function logout() {
  await endSession();
  redirect('/admin/login');
}

/**
 * The first account. Only works while there are no accounts. In production it needs the
 * ADMIN_SETUP_KEY set in Vercel; on a developer's machine with the local database it does not.
 */
export async function setup(_: FormState, f: FormData): Promise<FormState> {
  const key = process.env.ADMIN_SETUP_KEY;
  const local = process.env.NODE_ENV !== 'production' && !process.env.DATABASE_URL;
  if (!local && (!key || key.length < 16)) return { error: 'Set ADMIN_SETUP_KEY (16+ characters) in the Vercel project first.' };
  if (tooManyAttempts(`setup:${await clientIp()}`)) return { error: 'Too many attempts. Wait a minute.' };
  if ((await userCount()) > 0) return { error: 'An admin already exists. Sign in instead.' };
  if (!local && str(f, 'key', 500) !== key) return { error: 'The setup key is not right.' };
  const name = str(f, 'name', 100), email = str(f, 'email').toLowerCase(), password = String(f.get('password') ?? '');
  if (!name) return { error: 'Add your name.' };
  if (!EMAIL_RE.test(email)) return { error: 'Add a valid email.' };
  const bad = passwordProblem(password);
  if (bad) return { error: bad };
  const r = await sql()`INSERT INTO clinic_users (email, name, password_hash, role) VALUES (${email}, ${name}, ${await hashPassword(password)}, 'admin') RETURNING id`;
  await createSession((r[0] as { id: number }).id);
  redirect('/admin');
}

// ---------- accounts ----------

export async function changePassword(_: FormState, f: FormData): Promise<FormState> {
  const me = await requireUser();
  const current = String(f.get('current') ?? ''), next = String(f.get('next') ?? '');
  const row = (await sql()`SELECT password_hash FROM clinic_users WHERE id = ${me.id}`)[0] as { password_hash: string };
  if (!(await verifyPassword(current, row.password_hash))) return { error: 'Your current password is not right.' };
  const bad = passwordProblem(next);
  if (bad) return { error: bad };
  await sql()`UPDATE clinic_users SET password_hash = ${await hashPassword(next)} WHERE id = ${me.id}`;
  return { ok: 'Password changed.' };
}

export async function addUser(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const name = str(f, 'name', 100), email = str(f, 'email').toLowerCase();
  const role = f.get('role') === 'admin' ? 'admin' : 'editor';
  if (!name) return { error: 'Add a name.' };
  if (!EMAIL_RE.test(email)) return { error: 'Add a valid email.' };
  const temp = randomBytes(9).toString('base64url');
  try {
    await sql()`INSERT INTO clinic_users (email, name, password_hash, role) VALUES (${email}, ${name}, ${await hashPassword(temp)}, ${role})`;
  } catch {
    return { error: 'That email already has an account.' };
  }
  revalidatePath('/admin/users');
  return { ok: `Account created for ${name}. Their temporary password is ${temp}. Share it privately; they can change it under Account.` };
}

export async function resetPassword(id: number): Promise<FormState> {
  await requireAdmin();
  const temp = randomBytes(9).toString('base64url');
  await sql()`UPDATE clinic_users SET password_hash = ${await hashPassword(temp)} WHERE id = ${id}`;
  await sql()`DELETE FROM clinic_sessions WHERE user_id = ${id}`;
  return { ok: `New temporary password: ${temp}` };
}

export async function setDisabled(id: number, disabled: boolean): Promise<FormState> {
  const me = await requireAdmin();
  if (id === me.id) return { error: 'You cannot disable your own account.' };
  await sql()`UPDATE clinic_users SET disabled = ${disabled} WHERE id = ${id}`;
  if (disabled) await sql()`DELETE FROM clinic_sessions WHERE user_id = ${id}`;
  revalidatePath('/admin/users');
  return { ok: disabled ? 'Account disabled.' : 'Account enabled.' };
}

// ---------- treatments ----------

export async function newTreatment() {
  await requireUser();
  await ensureSchema();
  const slug = `draft-${randomBytes(4).toString('hex')}`;
  const r = await sql()`INSERT INTO clinic_treatments (slug, name) VALUES (${slug}, 'Untitled treatment') RETURNING id`;
  redirect(`/admin/treatments/${(r[0] as { id: number }).id}`);
}

export interface TreatmentInput {
  name: string; slug: string; ml: string; what: string; how: string;
  image: { url: string; alt: string } | null; clinics: string[]; sort: number;
}

export async function saveTreatment(id: number, input: TreatmentInput, mode: 'keep' | 'publish' | 'unpublish'): Promise<FormState & { slug?: string; status?: string }> {
  await requireUser();
  const old = (await sql()`SELECT slug, builtin_edit FROM clinic_treatments WHERE id = ${id}`)[0] as { slug: string; builtin_edit: boolean } | undefined;
  if (!old) return { error: 'That treatment no longer exists.' };

  const name = String(input.name ?? '').trim().slice(0, 120);
  const slug = slugify(String(input.slug || name));
  const what = String(input.what ?? '').trim().slice(0, 600);
  const how = String(input.how ?? '').trim().slice(0, 600);
  const ml = String(input.ml ?? '').trim().slice(0, 80);
  const imageUrl = input.image?.url && safeImage(input.image.url) ? input.image.url : null;
  const imageAlt = String(input.image?.alt ?? '').trim().slice(0, 300);
  const clinics = (Array.isArray(input.clinics) ? input.clinics : []).filter((c) => CLINIC_SLUGS.includes(c));
  const sort = Math.max(0, Math.min(999, Math.round(Number(input.sort) || 100)));

  // an edit of a built-in therapy keeps its address; its clinics are set on the Clinics page
  const builtIn = !!old.builtin_edit;
  if (builtIn) {
    if (!name) return { error: 'Give the treatment a name.' };
    if (mode === 'publish' && !what) return { error: 'Add a short description before publishing.' };
    if (mode === 'publish' && imageUrl && !imageAlt) return { error: 'Describe the image (alt text) before publishing.' };
    const status = mode === 'publish' ? 'published' : mode === 'unpublish' ? 'draft' : null;
    const r = await sql()`
      UPDATE clinic_treatments SET name = ${name}, ml = ${ml}, what = ${what}, how = ${how},
        image_url = ${imageUrl}, image_alt = ${imageAlt}, status = COALESCE(${status}::text, status), updated_at = now()
      WHERE id = ${id} RETURNING status`;
    const saved = (r[0] as { status: string }).status;
    const links = (await builtInClinics())[old.slug] ?? [];
    refreshSite([`/therapies/${old.slug}`, ...links.map((c) => `/clinics/${c}`)]);
    revalidatePath('/admin/treatments');
    if (saved === 'published') pingIndexNow([`/therapies/${old.slug}`, '/therapies']);
    return {
      ok: saved === 'published' ? 'Saved. The site shows your wording and photograph within a few minutes.'
        : mode === 'unpublish' ? 'Unpublished. The site shows the original wording again.' : 'Draft saved. The site still shows the original until you publish.',
      slug: old.slug, status: saved,
    };
  }

  if (!name) return { error: 'Give the treatment a name.' };
  if (!slug) return { error: 'The web address needs at least one letter or number.' };
  if (builtInTherapySlugs().has(slug)) return { error: `“${name}” is already one of the site’s built-in therapies. Choose another name or web address.` };
  if ((await sql()`SELECT 1 FROM clinic_treatments WHERE slug = ${slug} AND id <> ${id} LIMIT 1`).length) return { error: 'Another treatment already uses that web address.' };
  if (mode === 'publish') {
    if (!what) return { error: 'Add a short description before publishing.' };
    if (!clinics.length) return { error: 'Link the treatment to at least one clinic before publishing.' };
    if (imageUrl && !imageAlt) return { error: 'Describe the image (alt text) before publishing.' };
  }

  const status = mode === 'publish' ? 'published' : mode === 'unpublish' ? 'draft' : null;
  const r = await sql()`
    UPDATE clinic_treatments SET name = ${name}, slug = ${slug}, ml = ${ml}, what = ${what}, how = ${how},
      image_url = ${imageUrl}, image_alt = ${imageAlt}, clinics = ${clinics}, sort = ${sort},
      status = COALESCE(${status}::text, status), updated_at = now()
    WHERE id = ${id} RETURNING status`;
  // articles that pointed at the old address follow the rename
  if (old.slug !== slug) await sql()`UPDATE clinic_posts SET treatments = array_replace(treatments, ${old.slug}, ${slug})`;
  refreshSite(clinics.map((c) => `/clinics/${c}`));
  revalidatePath('/admin/treatments');
  const saved = (r[0] as { status: string }).status;
  if (saved === 'published') pingIndexNow([`/therapies/${slug}`, '/therapies', ...clinics.map((c) => `/clinics/${c}`)]);
  return { ok: saved === 'published' ? (mode === 'publish' ? 'Published. It now appears on the therapies page and its clinics.' : 'Saved. The live treatment is updated.') : mode === 'unpublish' ? 'Unpublished. It is a draft again.' : 'Draft saved.', slug, status: saved };
}

export async function deleteTreatment(id: number) {
  await requireUser();
  const row = (await sql()`SELECT slug FROM clinic_treatments WHERE id = ${id}`)[0] as { slug: string } | undefined;
  if (row) {
    await sql()`DELETE FROM clinic_treatments WHERE id = ${id}`;
    // deleting the edit of a built-in therapy (or an old row sharing its address) brings back the
    // original; articles stay linked to it
    if (!builtInTherapySlugs().has(row.slug)) await sql()`UPDATE clinic_posts SET treatments = array_remove(treatments, ${row.slug})`;
  }
  refreshSite(row ? [`/therapies/${row.slug}`] : []);
  redirect('/admin/treatments');
}

/** Opens a built-in therapy for editing: its wording and photograph are copied into a draft the first time. */
export async function editBuiltInTherapy(slug: string) {
  await requireUser();
  await ensureSchema();
  const t = THERAPIES.find((x) => x.slug === slug);
  if (!t) redirect('/admin/treatments');
  const have = (await sql()`SELECT id, builtin_edit FROM clinic_treatments WHERE slug = ${slug}`)[0] as { id: number; builtin_edit: boolean } | undefined;
  if (have?.builtin_edit) redirect(`/admin/treatments/${have.id}`);
  // a treatment added earlier under the same address becomes this edit, keeping its wording (and
  // taking the site's photograph if it had none), as a draft, so nothing changes until it is published
  const alt = t.img ? `${t.name} at AVVVS Ayur Speciality Clinic` : '';
  const r = await sql()`INSERT INTO clinic_treatments (slug, name, ml, what, how, image_url, image_alt, status, builtin_edit)
    VALUES (${t.slug}, ${t.name}, ${t.ml}, ${t.what}, ${t.how}, ${t.img ?? null}, ${alt}, 'draft', TRUE)
    ON CONFLICT (slug) DO UPDATE SET
      image_alt = CASE WHEN clinic_treatments.image_url IS NULL THEN EXCLUDED.image_alt ELSE clinic_treatments.image_alt END,
      image_url = COALESCE(clinic_treatments.image_url, EXCLUDED.image_url),
      ml = CASE WHEN clinic_treatments.ml = '' THEN EXCLUDED.ml ELSE clinic_treatments.ml END,
      status = 'draft', builtin_edit = TRUE, updated_at = now()
    RETURNING id`;
  redirect(`/admin/treatments/${(r[0] as { id: number }).id}`);
}

// ---------- clinics: which therapies each one recommends ----------

/**
 * Sets the full list of therapies shown under one clinic. Built-in therapies keep their links in
 * clinic_builtin_links; treatments added in the admin keep theirs on the treatment itself.
 */
export async function setClinicTherapies(clinic: string, selected: string[]): Promise<FormState> {
  await requireUser();
  if (!CLINIC_SLUGS.includes(clinic)) return { error: 'Unknown clinic.' };
  await ensureSchema();
  const want = new Set((Array.isArray(selected) ? selected : []).map(String));

  const links = await builtInClinics();
  for (const [slug, clinics] of Object.entries(links)) {
    const has = clinics.includes(clinic);
    if (has === want.has(slug)) continue;
    const next = has ? clinics.filter((c) => c !== clinic) : [...clinics, clinic];
    await sql()`INSERT INTO clinic_builtin_links (slug, clinics, updated_at) VALUES (${slug}, ${next}, now())
      ON CONFLICT (slug) DO UPDATE SET clinics = EXCLUDED.clinics, updated_at = now()`;
  }

  const added = (await sql()`SELECT slug, clinics FROM clinic_treatments`) as { slug: string; clinics: string[] }[];
  for (const t of added) {
    if (t.slug in links) continue; // an edit of a built-in therapy: its clinics were set above
    const has = (t.clinics ?? []).includes(clinic);
    if (has === want.has(t.slug)) continue;
    if (has) await sql()`UPDATE clinic_treatments SET clinics = array_remove(clinics, ${clinic}), updated_at = now() WHERE slug = ${t.slug}`;
    else await sql()`UPDATE clinic_treatments SET clinics = array_append(clinics, ${clinic}), updated_at = now() WHERE slug = ${t.slug}`;
  }

  refreshSite([`/clinics/${clinic}`]);
  pingIndexNow([`/clinics/${clinic}`]);
  revalidatePath('/admin/clinics');
  revalidatePath('/admin/treatments');
  return { ok: 'Saved. The clinic page shows these therapies within a few minutes.' };
}

export async function resetBuiltInLinks(): Promise<FormState> {
  await requireAdmin();
  await sql()`DELETE FROM clinic_builtin_links`;
  refreshSite();
  revalidatePath('/admin/clinics');
  return { ok: 'The built-in therapies are back on their original clinics.' };
}

// ---------- clinic page text ----------

function refreshClinic(slug: string) {
  for (const p of ['/', '/clinics', `/clinics/${slug}`, '/llms.txt', '/llms-full.txt']) revalidatePath(p);
  revalidatePath('/clinics/[slug]', 'page');
  revalidatePath(`/admin/clinics/${slug}`);
}

/** Saves the wording of one clinic's page. */
export async function saveClinicText(slug: string, input: unknown): Promise<FormState> {
  await requireUser();
  if (!CLINIC_SLUGS.includes(slug)) return { error: 'Unknown clinic.' };
  const t = cleanClinicText(input, slug);
  if (!t) return { error: 'The text could not be read. Reload the page and try again.' };
  if (!t.body.length && !t.lede) return { error: 'Keep at least one paragraph about the clinic.' };
  if (!t.focus.length) return { error: 'Keep at least one point under “What care looks like”, each with a heading and text.' };
  if (!t.faq.length) return { error: 'Keep at least one question, with its answer.' };
  await ensureSchema();
  await sql()`INSERT INTO clinic_meta (key, value) VALUES (${`clinic_text:${slug}`}, ${JSON.stringify(t)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  refreshClinic(slug);
  pingIndexNow([`/clinics/${slug}`]);
  return { ok: 'Saved. The clinic page shows your wording within a few minutes.' };
}

export async function resetClinicText(slug: string): Promise<FormState> {
  await requireUser();
  if (!CLINIC_SLUGS.includes(slug)) return { error: 'Unknown clinic.' };
  await sql()`DELETE FROM clinic_meta WHERE key = ${`clinic_text:${slug}`}`;
  refreshClinic(slug);
  return { ok: 'The original wording is back.' };
}

// ---------- the site's photographs ----------

/** Replaces one of the site's photographs, or with null puts back the one built into the site. */
export async function setSitePhoto(id: string, photo: { url: string; alt: string } | null): Promise<FormState> {
  await requireUser();
  const def = sitePhotoDef(id);
  if (!def) return { error: 'Unknown photograph.' };
  await ensureSchema();
  const key = `photo:${id}`;
  if (!photo) {
    await sql()`DELETE FROM clinic_meta WHERE key = ${key}`;
  } else {
    const url = String(photo.url ?? '');
    const alt = String(photo.alt ?? '').trim().slice(0, 300);
    if (!safeImage(url)) return { error: 'Upload the photograph again.' };
    if (!alt && !isDecorative(id)) return { error: 'Describe the photograph for people who cannot see it.' };
    const value = JSON.stringify({ src: url, alt, position: '50% 50%' });
    await sql()`INSERT INTO clinic_meta (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
  revalidatePath(def.page);
  if (def.page.startsWith('/clinics/') || isDecorative(id)) revalidatePath('/clinics/[slug]', 'page');
  if (isDecorative(id)) revalidatePath('/clinics');
  revalidatePath('/admin/photos');
  return { ok: photo ? 'Saved. The page shows the new photograph within a few minutes.' : 'The original photograph is back.' };
}

// ---------- online booking ----------

export async function setOnlineBooking(on: boolean): Promise<FormState> {
  await requireAdmin();
  await ensureSchema();
  await sql()`INSERT INTO clinic_meta (key, value) VALUES ('online_booking', ${on ? 'on' : 'off'}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  revalidatePath('/consult');
  revalidatePath('/admin/settings');
  revalidatePath('/admin');
  return { ok: on ? 'Online booking is switched on.' : 'Online booking is switched off. Existing appointments are not affected.' };
}

// ---------- doctors ----------

export async function newDoctor() {
  await requireUser();
  await ensureSchema();
  const slug = `draft-${randomBytes(4).toString('hex')}`;
  const r = await sql()`INSERT INTO clinic_doctors (slug, name, visible, sort) VALUES (${slug}, 'New doctor', FALSE,
    (SELECT COALESCE(MAX(sort), 0) + 10 FROM clinic_doctors)) RETURNING id`;
  redirect(`/admin/doctors/${(r[0] as { id: number }).id}`);
}

export interface DoctorInput { name: string; quals: string; role: string; photo: string | null; sort: number; visible: boolean }

export async function saveDoctor(id: number, input: DoctorInput): Promise<FormState> {
  await requireUser();
  const old = (await sql()`SELECT slug FROM clinic_doctors WHERE id = ${id}`)[0] as { slug: string } | undefined;
  if (!old) return { error: 'That doctor is no longer on the list.' };
  const name = String(input.name ?? '').trim().slice(0, 120);
  const quals = String(input.quals ?? '').split(/[,·\n]+/).map((q) => q.trim()).filter(Boolean).slice(0, 12).map((q) => q.slice(0, 40));
  const role = String(input.role ?? '').trim().slice(0, 120);
  const photo = input.photo && safeImage(input.photo) ? input.photo : null;
  const sort = Math.max(0, Math.min(9999, Math.round(Number(input.sort) || 100)));
  const visible = !!input.visible;
  if (!name || name === 'New doctor') return { error: 'Add the doctor’s name.' };
  if (visible && !quals.length) return { error: 'Add at least one qualification before showing the doctor on the site.' };
  if (visible && !photo) return { error: 'Add a photograph before showing the doctor on the site.' };
  // a new doctor's address comes from their name; an existing one keeps theirs, so links keep working
  let slug = old.slug;
  if (slug.startsWith('draft-')) {
    slug = slugify(name.replace(/^dr\.?\s+/i, '')) || slug;
    if ((await sql()`SELECT 1 FROM clinic_doctors WHERE slug = ${slug} AND id <> ${id}`).length) slug = `${slug}-${randomBytes(2).toString('hex')}`;
  }
  await sql()`UPDATE clinic_doctors SET slug = ${slug}, name = ${name}, quals = ${quals}, role = ${role}, photo_url = ${photo},
    sort = ${sort}, visible = ${visible}, updated_at = now() WHERE id = ${id}`;
  refreshDoctors();
  if (visible) pingIndexNow([`/doctors/${slug}`, '/doctors']);
  return { ok: visible ? 'Saved. The doctor is shown on the site within a few minutes.' : 'Saved. The doctor is hidden from the site.' };
}

export async function deleteDoctor(id: number) {
  await requireUser();
  await sql()`DELETE FROM clinic_doctors WHERE id = ${id}`;
  refreshDoctors();
  redirect('/admin/doctors');
}

/** Moves a doctor one place up or down the list. */
export async function moveDoctor(id: number, by: -1 | 1) {
  await requireUser();
  const list = (await sql()`SELECT id FROM clinic_doctors ORDER BY sort, name`) as { id: number }[];
  const i = list.findIndex((d) => d.id === id), j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  for (const [k, d] of list.entries()) await sql()`UPDATE clinic_doctors SET sort = ${(k + 1) * 10} WHERE id = ${d.id}`;
  refreshDoctors();
}

function refreshDoctors() {
  // every public page carries the doctors in its structured data
  revalidatePath('/', 'layout');
  revalidatePath('/doctors/[slug]', 'page');
  revalidatePath('/admin/doctors');
}

// ---------- journal ----------

export async function newPost() {
  const me = await requireUser();
  await ensureSchema();
  const slug = `draft-${randomBytes(4).toString('hex')}`;
  const r = await sql()`INSERT INTO clinic_posts (slug, title, author_id) VALUES (${slug}, 'Untitled article', ${me.id}) RETURNING id`;
  redirect(`/admin/journal/${(r[0] as { id: number }).id}`);
}

export interface PostInput {
  title: string; slug: string; dek: string; answer: string; kind: string;
  cover: { url: string; alt: string } | null; body: unknown; clinic: string; treatments: string[]; reviewer: string;
  faq: { q: string; a: string }[];
}

/** Opens a built-in article for editing: the first time, its text is copied into a draft. */
export async function editBuiltInPost(slug: string) {
  const me = await requireUser();
  await ensureSchema();
  const p = BUILT_IN_POSTS.find((x) => x.slug === slug);
  if (!p) redirect('/admin/journal');
  const have = (await sql()`SELECT id FROM clinic_posts WHERE slug = ${slug} AND builtin_edit`)[0] as { id: number } | undefined;
  if (have) redirect(`/admin/journal/${have.id}`);
  const r = await sql()`INSERT INTO clinic_posts (slug, title, dek, answer, kind, cover_url, cover_alt, body, faq, clinic, treatments, reviewer, status, author_id, published_at, builtin_edit)
    VALUES (${p.slug}, ${p.title}, ${p.dek}, ${p.answer}, ${p.kind}, ${p.cover.src}, ${p.cover.alt}, ${JSON.stringify(p.blocks)}::jsonb, ${JSON.stringify(p.faq ?? [])}::jsonb,
      ${p.clinic ?? null}, ${p.treatments ?? []}, ${p.reviewer ?? null}, 'draft', ${me.id}, ${`${p.published}T12:00:00Z`}, TRUE)
    ON CONFLICT (slug) DO UPDATE SET builtin_edit = TRUE RETURNING id`;
  redirect(`/admin/journal/${(r[0] as { id: number }).id}`);
}

export async function savePost(id: number, input: PostInput, mode: 'keep' | 'publish' | 'unpublish'): Promise<FormState & { slug?: string; status?: string }> {
  await requireUser();
  const old = (await sql()`SELECT slug, builtin_edit FROM clinic_posts WHERE id = ${id}`)[0] as { slug: string; builtin_edit: boolean } | undefined;
  if (!old) return { error: 'That article no longer exists.' };

  const title = String(input.title ?? '').trim().slice(0, 160);
  // an edited built-in article keeps its address, so links to it keep working
  const slug = old.builtin_edit ? old.slug : slugify(String(input.slug || title));
  const faq = cleanFaq(input.faq);
  const dek = String(input.dek ?? '').trim().slice(0, 400);
  const answer = String(input.answer ?? '').trim().slice(0, 700);
  const kind = (POST_KINDS as readonly string[]).includes(input.kind) ? input.kind : POST_KINDS[0];
  const body = cleanBlocks(input.body);
  const coverUrl = input.cover?.url && safeImage(input.cover.url) ? input.cover.url : null;
  const coverAlt = String(input.cover?.alt ?? '').trim().slice(0, 300);
  const clinic = CLINIC_SLUGS.includes(input.clinic) ? input.clinic : null;
  const treatments = (Array.isArray(input.treatments) ? input.treatments : []).map((t) => slugify(String(t))).filter(Boolean).slice(0, 20);
  const reviewerSlug = String(input.reviewer ?? '').trim();
  const reviewer = reviewerSlug && (await sql()`SELECT 1 FROM clinic_doctors WHERE slug = ${reviewerSlug}`).length ? reviewerSlug : null;

  if (!title) return { error: 'Give the article a title.' };
  if (!slug) return { error: 'The web address needs at least one letter or number.' };
  if (!old.builtin_edit && builtInPostSlugs().has(slug)) return { error: 'That web address belongs to one of the built-in articles. Choose another.' };
  if ((await sql()`SELECT 1 FROM clinic_posts WHERE slug = ${slug} AND id <> ${id} LIMIT 1`).length) return { error: 'Another article already uses that web address.' };
  if (mode === 'publish') {
    if (!dek) return { error: 'Add a short summary before publishing.' };
    if (!answer) return { error: 'Add the short answer before publishing. It is what search and AI answers quote.' };
    if (!body.some((b) => b.t === 'p' && b.text.trim())) return { error: 'Add at least one paragraph before publishing.' };
    if (coverUrl && !coverAlt) return { error: 'Describe the cover image (alt text) before publishing.' };
    if (body.some((b) => b.t === 'img' && !b.alt.trim())) return { error: 'Describe every image in the article (alt text) before publishing.' };
  }

  const status = mode === 'publish' ? 'published' : mode === 'unpublish' ? 'draft' : null;
  const r = await sql()`
    UPDATE clinic_posts SET title = ${title}, slug = ${slug}, dek = ${dek}, answer = ${answer}, kind = ${kind},
      cover_url = ${coverUrl}, cover_alt = ${coverAlt}, body = ${JSON.stringify(body)}::jsonb, faq = ${JSON.stringify(faq)}::jsonb, clinic = ${clinic}, treatments = ${treatments}, reviewer = ${reviewer},
      status = COALESCE(${status}::text, status),
      published_at = CASE WHEN ${status}::text = 'published' AND published_at IS NULL THEN now() ELSE published_at END,
      updated_at = now()
    WHERE id = ${id} RETURNING status`;
  refreshSite([`/journal/${slug}`, `/journal/${old.slug}`, ...(clinic ? [`/clinics/${clinic}`] : [])]);
  revalidatePath('/admin/journal');
  const saved = (r[0] as { status: string }).status;
  if (saved === 'published') pingIndexNow([`/journal/${slug}`, '/journal', ...(clinic ? [`/clinics/${clinic}`] : [])]);
  if (old.builtin_edit) return {
    ok: saved === 'published' ? 'Saved. The Journal shows your version within a few minutes.'
      : mode === 'unpublish' ? 'Unpublished. The Journal shows the original article again.' : 'Draft saved. The Journal still shows the original until you publish.',
    slug, status: saved,
  };
  return { ok: saved === 'published' ? (mode === 'publish' ? 'Published.' : 'Saved. The live article is updated.') : mode === 'unpublish' ? 'Unpublished. It is a draft again.' : 'Draft saved.', slug, status: saved };
}

export async function deletePost(id: number) {
  await requireUser();
  const row = (await sql()`SELECT slug FROM clinic_posts WHERE id = ${id}`)[0] as { slug: string } | undefined;
  if (row) await sql()`DELETE FROM clinic_posts WHERE id = ${id}`;
  refreshSite(row ? [`/journal/${row.slug}`] : []);
  redirect('/admin/journal');
}
