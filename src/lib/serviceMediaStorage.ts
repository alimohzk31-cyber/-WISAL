import { supabase } from './supabase';
import { isOnlineConnection, requireOnlineConnection } from './connectivity';

export const SERVICE_MEDIA_BUCKET = 'service-media';

export interface UploadedServiceMedia {
  path: string;
  publicUrl: string;
}

function safeExtension(file: File, fallback: string): string {
  return (file.name.split('.').pop() || fallback).toLowerCase().replace(/[^a-z0-9]/g, '') || fallback;
}

/** Shared uploader for every public media flow that uses service-media. */
export async function uploadServiceMediaFile(file: File, folder: string, fallbackExtension: string): Promise<UploadedServiceMedia> {
  requireOnlineConnection();
  const extension = safeExtension(file, fallbackExtension);
  const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const { error } = await supabase.storage.from(SERVICE_MEDIA_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(SERVICE_MEDIA_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('تعذر الحصول على رابط الملف بعد رفعه.');
  return { path, publicUrl: data.publicUrl };
}

export async function removeServiceMediaFiles(paths: string[]): Promise<void> {
  if (!paths.length) return;
  if (!isOnlineConnection()) return;
  const { error } = await supabase.storage.from(SERVICE_MEDIA_BUCKET).remove(paths);
  if (error) console.warn('[Storage] Could not clean up uploaded media:', error.message);
}
