import { supabase } from '../../lib/supabase';
import { requireOnlineConnection } from '../../lib/connectivity';
import type { JobApplication, JobApplicationDraft } from './types';

export const MAX_CV_BYTES = 5 * 1024 * 1024;
export const CV_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const CV_BUCKET = 'job-applications';

function extensionFor(file: File) {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

function applicationSetupError(error: any) {
  return ['42P01', 'PGRST205', '42501'].includes(String(error?.code || ''))
    || /job_applications|row-level security|bucket/i.test(`${error?.message || ''} ${error?.details || ''}`);
}

export async function submitJobApplication(jobId: number, draft: JobApplicationDraft, cv: File): Promise<void> {
  requireOnlineConnection();
  const path = `${jobId}/${crypto.randomUUID()}.${extensionFor(cv)}`;
  const upload = await supabase.storage.from(CV_BUCKET).upload(path, cv, { contentType: cv.type, upsert: false });
  if (upload.error) {
    if (applicationSetupError(upload.error)) throw new Error('ميزة التقديم بانتظار تفعيل ملف supabase_job_applications.sql.');
    throw upload.error;
  }
  const { error } = await supabase.from('job_applications').insert({
    job_id: jobId,
    full_name: draft.fullName.trim(),
    phone: draft.phone.trim(),
    email: draft.email?.trim() || null,
    governorate: draft.governorate.trim(),
    area: draft.area.trim(),
    experience: draft.experience?.trim() || null,
    message: draft.message?.trim() || null,
    cv_path: path,
    cv_name: cv.name.slice(0, 180),
    cv_mime_type: cv.type,
  });
  if (!error) return;
  await supabase.storage.from(CV_BUCKET).remove([path]);
  if (applicationSetupError(error)) throw new Error('ميزة التقديم بانتظار تفعيل ملف supabase_job_applications.sql.');
  throw error;
}

export async function loadJobApplications(): Promise<JobApplication[]> {
  const { data, error } = await supabase.from('job_applications')
    .select('id,job_id,full_name,phone,email,governorate,area,experience,message,cv_path,cv_name,cv_mime_type,created_at,jobs(title,company)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: Number(row.id), jobId: Number(row.job_id), fullName: row.full_name, phone: row.phone,
    email: row.email || undefined, governorate: row.governorate, area: row.area,
    experience: row.experience || undefined, message: row.message || undefined,
    cvPath: row.cv_path, cvName: row.cv_name, cvMimeType: row.cv_mime_type,
    createdAt: row.created_at, jobTitle: row.jobs?.title, company: row.jobs?.company,
  }));
}

export async function openApplicationCv(path: string): Promise<void> {
  const { data, error } = await supabase.storage.from(CV_BUCKET).createSignedUrl(path, 60);
  if (error) throw error;
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}
