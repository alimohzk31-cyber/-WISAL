import { supabase } from './supabase';
import { isOnlineConnection, requireOnlineConnection } from './connectivity';

export const COMPLAINT_MEDIA_BUCKET = 'complaint-media';
export const COMPLAINT_MEDIA_MAX_BYTES = 2 * 1024 * 1024;
export const COMPLAINT_MEDIA_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const extensionByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function validateComplaintImage(file: File): string {
  const mimeType = file.type.toLowerCase();
  if (!COMPLAINT_MEDIA_MIME_TYPES.has(mimeType)) {
    throw new Error('Only JPEG, PNG, WebP, and GIF images are allowed.');
  }
  if (file.size <= 0 || file.size > COMPLAINT_MEDIA_MAX_BYTES) {
    throw new Error('Complaint images must be smaller than 2 MB.');
  }
  return extensionByMime[mimeType];
}

function safeComplaintPath(path: string): boolean {
  return /^incoming\/[A-Za-z0-9-]+\.(?:jpg|jpeg|png|webp|gif)$/i.test(path)
    && !path.includes('..')
    && !path.includes('\\');
}

function generatedToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function uploadComplaintImage(file: File): Promise<string> {
  requireOnlineConnection();
  const extension = validateComplaintImage(file);
  const path = `incoming/${generatedToken()}.${extension}`;
  const { error } = await supabase.storage.from(COMPLAINT_MEDIA_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function createComplaintImageUrl(path: string): Promise<string | null> {
  if (!path || !safeComplaintPath(path)) return null;
  const { data, error } = await supabase.storage
    .from(COMPLAINT_MEDIA_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

export async function removeComplaintImage(path: string | null | undefined): Promise<void> {
  if (!path || !safeComplaintPath(path) || !isOnlineConnection()) return;
  const { error } = await supabase.storage.from(COMPLAINT_MEDIA_BUCKET).remove([path]);
  if (error) console.warn('[ComplaintStorage] Could not clean up complaint image:', error.message);
}
