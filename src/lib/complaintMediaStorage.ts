import { supabase } from './supabase';
import { isOnlineConnection, requireOnlineConnection } from './connectivity';

export const COMPLAINT_MEDIA_BUCKET = 'complaint-media';

function safeExtension(file: File): string {
  return (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
}

export async function uploadComplaintImage(file: File): Promise<string> {
  requireOnlineConnection();
  const path = `incoming/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${safeExtension(file)}`;
  const { error } = await supabase.storage.from(COMPLAINT_MEDIA_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function createComplaintImageUrl(path: string): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabase.storage
    .from(COMPLAINT_MEDIA_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

export async function removeComplaintImage(path: string | null | undefined): Promise<void> {
  if (!path || /^https?:\/\//i.test(path) || !isOnlineConnection()) return;
  const { error } = await supabase.storage.from(COMPLAINT_MEDIA_BUCKET).remove([path]);
  if (error) console.warn('[ComplaintStorage] Could not clean up complaint image:', error.message);
}
