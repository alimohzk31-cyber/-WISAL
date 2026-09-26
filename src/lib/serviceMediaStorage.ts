import { supabase } from './supabase';
import { isOnlineConnection, requireOnlineConnection } from './connectivity';

export const SERVICE_MEDIA_BUCKET = 'service-media';

export interface UploadedServiceMedia {
  path: string;
  publicUrl: string;
}

export function validateServiceMediaFile(file: File, fallback: string): string {
  const mime = file.type.toLowerCase();
  const extensionByMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };
  const extension = extensionByMime[mime];
  if (!extension) throw new Error('نوع ملف الوسائط غير مسموح.');
  const maximumBytes = mime.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size <= 0 || file.size > maximumBytes) throw new Error('حجم ملف الوسائط غير مسموح.');
  return extension || fallback;
}

function safeFolder(folder: string): string {
  const normalized = folder.replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized.includes('..') || normalized.includes('\\') || !/^[A-Za-z0-9/_-]+$/.test(normalized)) {
    throw new Error('مسار الوسائط غير مسموح.');
  }
  return normalized;
}

function generatedFileName(extension: string): string {
  const token = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${token}.${extension}`;
}

/** Shared uploader for every public media flow that uses service-media. */
export async function uploadServiceMediaFile(file: File, folder: string, fallbackExtension: string): Promise<UploadedServiceMedia> {
  requireOnlineConnection();
  const extension = validateServiceMediaFile(file, fallbackExtension);
  const path = `${safeFolder(folder)}/${generatedFileName(extension)}`;
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
