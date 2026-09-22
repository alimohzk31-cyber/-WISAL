import { supabase } from '../../lib/supabase';
import { optimizeImageFile } from '../../lib/imageOptimization';
import { uploadServiceMediaFile } from '../../lib/serviceMediaStorage';
import { mapJob } from '../jobs/jobData';
import type { Job } from '../jobs/types';

export type ProfileImageKind = 'avatar' | 'cover';

export interface UserProfile {
  id: string;
  full_name: string | null;
  role?: string | null;
  profession?: string | null;
  governorate?: string | null;
  area?: string | null;
  bio?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  whatsapp_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  portfolio_images?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProfileService {
  id: string | number;
  title: string;
  description?: string | null;
  profession?: string | null;
  address?: string | null;
  image_url?: string | null;
  category_slug?: string | null;
  status?: string | null;
}

export type ProfileJob = Job;

export const PROFILE_COLUMNS = [
  'id', 'full_name', 'role', 'profession', 'governorate', 'area', 'bio', 'phone',
  'avatar_url', 'cover_url', 'whatsapp_url', 'facebook_url', 'instagram_url', 'tiktok_url',
  'portfolio_images', 'created_at', 'updated_at',
].join(',');

const TEXT_COLUMNS = [
  'full_name', 'profession', 'governorate', 'area', 'bio', 'phone',
  'whatsapp_url', 'facebook_url', 'instagram_url', 'tiktok_url',
] as const;

let serviceOwnerColumn: boolean | null = null;
let jobOwnerColumn: boolean | null = null;
async function hasVerifiedServiceOwnerColumn(): Promise<boolean> {
  if (serviceOwnerColumn !== null) return serviceOwnerColumn;
  const { error } = await supabase.from('services').select('owner_id').limit(1);
  serviceOwnerColumn = !error;
  return serviceOwnerColumn;
}

async function hasVerifiedJobOwnerColumn(): Promise<boolean> {
  if (jobOwnerColumn !== null) return jobOwnerColumn;
  const { error } = await supabase.from('jobs').select('owner_uid').limit(0);
  jobOwnerColumn = !error;
  return jobOwnerColumn;
}

async function assertCurrentUser(userId: string) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || data.user.id !== userId) {
    throw error ?? new Error('لا يمكن تعديل ملف مستخدم آخر.');
  }
}

export async function loadProfile(userId: string): Promise<UserProfile | null> {
  await assertCurrentUser(userId);
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as unknown as UserProfile | null;
}

export async function saveProfileText(userId: string, values: Partial<Pick<UserProfile, typeof TEXT_COLUMNS[number]>>): Promise<UserProfile> {
  await assertCurrentUser(userId);
  const payload = Object.fromEntries(TEXT_COLUMNS.map(column => [column, values[column] ?? null]));
  const { data, error } = await supabase.from('profiles').update(payload).eq('id', userId).select(PROFILE_COLUMNS).single();
  if (error) throw error;
  return data as unknown as UserProfile;
}

export async function saveProfileImage(userId: string, kind: ProfileImageKind, sourceFile: File): Promise<string> {
  await assertCurrentUser(userId);
  const optimized = await optimizeImageFile(sourceFile, kind === 'avatar' ? 1200 : 2000, kind === 'avatar' ? 1200 : 1000, 0.84);
  const uploaded = await uploadServiceMediaFile(optimized, `contact/profiles/${userId}/${kind}`, 'webp');
  const column = kind === 'avatar' ? 'avatar_url' : 'cover_url';
  const { error } = await supabase.from('profiles').update({ [column]: uploaded.publicUrl, updated_at: new Date().toISOString() }).eq('id', userId);
  if (error) throw error;
  return uploaded.publicUrl;
}

export async function loadProfileServices(userId: string): Promise<{ items: ProfileService[]; ownershipAvailable: boolean }> {
  try {
    if (!(await hasVerifiedServiceOwnerColumn())) return { items: [], ownershipAvailable: false };
    const { data, error } = await supabase.from('services')
      .select('id,title,description,profession,address,image_url,category_slug,owner_id,status')
      .eq('owner_id', userId).order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return { items: (data ?? []) as ProfileService[], ownershipAvailable: true };
  } catch (error) {
    console.warn('[Profile:services.load.failed]', { message: (error as any)?.message, code: (error as any)?.code });
    return { items: [], ownershipAvailable: false };
  }
}

export async function loadProfileJobs(userId: string): Promise<{ items: ProfileJob[]; ownershipAvailable: boolean }> {
  try {
    if (!(await hasVerifiedJobOwnerColumn())) return { items: [], ownershipAvailable: false };
    const { data, error } = await supabase.from('jobs')
      .select('id,title,company,specialty,description,governorate,area,employment_type,salary,experience,qualification,phone,image_url,created_at,status,owner_uid')
      .eq('owner_uid', userId).order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    return { items: (data ?? []).map(mapJob), ownershipAvailable: true };
  } catch (error) {
    console.warn('[Profile:jobs.load.failed]', { message: (error as any)?.message, code: (error as any)?.code });
    return { items: [], ownershipAvailable: false };
  }
}
