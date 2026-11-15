import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { ensureSchema } from '@/lib/db';
import { CLINIC_SLUGS, clinicName, clinicTextOverrides } from '@/lib/content';
import { defaultClinicText } from '@/lib/clinicPages';
import { ClinicTextEditor } from './ClinicTextEditor';

export const metadata = { title: 'Edit clinic page' };

export default async function EditClinic({ params }: { params: Promise<{ slug: string }> }) {
  await requireUser();
  const slug = (await params).slug;
  const original = defaultClinicText(slug);
  if (!CLINIC_SLUGS.includes(slug) || !original) notFound();
  await ensureSchema();
  const edited = (await clinicTextOverrides())[slug] ?? null;
  return <ClinicTextEditor slug={slug} name={clinicName(slug)} initial={edited ?? original} edited={!!edited} />;
}
