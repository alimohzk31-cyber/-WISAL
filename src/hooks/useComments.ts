import { supabase } from '../lib/supabase';
import { getOwnerId } from './useServices';

// Length rules for a comment.
export const COMMENT_MIN_LENGTH = 5;
export const COMMENT_MAX_LENGTH = 100;

export interface Comment {
  id: number;
  content: string;
  image_url?: string | null;
  owner_id?: string | null;
  created_at?: string | null;
}

// Reuse the device-based user identity used everywhere else in the app.
// There is no separate login system for regular users.
export function getCommentOwnerId(): string {
  return getOwnerId();
}

// Helper to upload an image to the existing Supabase storage.
// Reuses the same storage system used elsewhere in the project.
export async function uploadCommentImage(file: File): Promise<string | null> {
  try {
    const fileName = 'comment_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11) + '.' + (file.name.split('.').pop() || 'jpg');
    const { error } = await supabase.storage
      .from('services-images') // reuse existing bucket used throughout the app
      .upload(fileName, file);

    if (error) {
      const storageErr = error as any;
      console.error('[Comments] image upload failed:', {
        message: storageErr?.message, code: storageErr?.code, details: storageErr?.details, hint: storageErr?.hint,
      });
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from('services-images')
      .getPublicUrl(fileName);

    return urlData?.publicUrl ?? null;
  } catch (e) {
    console.error('[Comments] uploadCommentImage failed:', e);
    return null;
  }
}

// Fetch comments, newest first. Optional limit for callers that only need
// the most recent rows (e.g. notifications). Backward compatible: omitting
// the argument returns all rows exactly as before.
export async function fetchComments(limit?: number): Promise<Comment[]> {
  let query = supabase
    .from('comments')
    .select('*')
    .order('created_at', { ascending: false });

  if (limit !== undefined && limit > 0) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Comments] fetch failed:', {
      message: error.message, code: error.code, details: error.details, hint: error.hint,
    });
    throw error;
  }
  return (data as Comment[]) || [];
}

// Post a new comment. Returns the inserted row so the UI can show it
// immediately. No mock/offline fallback: missing table surfaces the real error.
export async function addComment(input: {
  content: string;
  image_url?: string | null;
}): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      content: input.content,
      image_url: input.image_url || null,
      owner_id: getCommentOwnerId(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Comments] add failed:', {
      message: error.message, code: error.code, details: error.details, hint: error.hint,
    });
    throw error;
  }
  return data as Comment;
}

// Update the text content of an existing comment.
// Used by admin panel to edit a comment.
export async function updateCommentContent(id: number, content: string): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .update({ content })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Comments] updateContent failed:', {
      message: error.message, code: error.code, details: error.details, hint: error.hint,
    });
    throw error;
  }
  return data as Comment;
}

// Update the image_url of an existing comment.
// Used by admin panel to attach/replace/remove an image.
export async function updateCommentImage(id: number, image_url: string | null): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .update({ image_url })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Comments] updateImage failed:', {
      message: error.message, code: error.code, details: error.details, hint: error.hint,
    });
    throw error;
  }
  return data as Comment;
}

// Delete a comment by id. Used by admin panel.
// IMPORTANT: without .select(), PostgREST returns success (error = null) even
// when RLS silently blocked the delete or the row does not exist (0 rows).
// We must treat a 0-row result as a failure so the UI never removes a comment
// that still exists in public.comments.
export async function deleteComment(id: number): Promise<void> {
  const { data, error } = await supabase
    .from('comments')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[Comments] delete failed:', {
      message: error.message, code: error.code, details: error.details, hint: error.hint,
    });
    throw error;
  }

  if (!data || data.length === 0) {
    // Nothing was actually deleted. Most likely cause: RLS policy on
    // public.comments blocking this client's DELETE, or the row vanished.
    const message =
      'تعذر حذف التعليق من قاعدة البيانات: تم حذف 0 صف. السبب الأكثر احتمالاً هو سياسة RLS على جدول comments تمنع الحذف.';
    console.error('[Comments] delete affected 0 rows:', {
      id,
      hint: 'RLS policy "comments_delete_policy" may be missing/restrictive on public.comments, or the row was already deleted.',
    });
    const err: any = new Error(message);
    err.code = 'DELETE_AFFECTED_0_ROWS';
    throw err;
  }
}
