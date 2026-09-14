import { supabase } from '../lib/supabase';
import { uploadServiceMediaFile } from '../lib/serviceMediaStorage';
import { requireOnlineConnection } from '../lib/connectivity';

// Message types accepted by the contact_messages table.
export type ContactMessageType =
  | 'bug'
  | 'suggestion'
  | 'advice'
  | 'complaint'
  | 'other';

// Status values used by the admin panel
export type ContactMessageStatus = 'new' | 'review' | 'resolved';

export const MESSAGE_STATUS_LABELS: Record<ContactMessageStatus, string> = {
  new: 'جديدة',
  review: 'قيد المراجعة',
  resolved: 'تم الحل',
};

export interface ContactMessage {
  id: number;
  message_type: string;
  message: string;
  image_url?: string | null;
  status: string;
  created_at?: string | null;
}

// Send a new suggestion straight into public.contact_messages.
// No account / email / login / user id required — the INSERT policy allows
// anon with status = 'new', and we never set owner_id.
export async function sendContactMessage(input: {
  message_type: ContactMessageType;
  message: string;
  image_url?: string | null;
}): Promise<void> {
  requireOnlineConnection();
  const message = input.message.trim();
  if (!message) {
    throw new Error('يرجى كتابة نص الاقتراح.');
  }
  if (message.length > 1000) {
    throw new Error('نص الاقتراح يجب ألا يتجاوز 1000 حرف.');
  }

  const { error } = await supabase
    .from('contact_messages')
    .insert({
      message_type: input.message_type,
      message,
      image_url: input.image_url || null,
      status: 'new',
    });

  if (error) {
    console.error('[Contact] send failed:', {
      message: error.message, code: error.code, details: error.details, hint: error.hint,
    });
    throw error;
  }
}

export async function uploadContactMessageImage(file: File): Promise<string> {
  return (await uploadServiceMediaFile(file, 'contact', 'jpg')).publicUrl;
}

// Fetch all suggestions (newest first) for the admin panel.
// The admin panel opens with a PIN (no Supabase Auth session), so it reads via
// the SECURITY DEFINER admin RPC — the same pattern already used for services.
// The SELECT policy on contact_messages stays untouched (authenticated + is_admin()).
export async function fetchContactMessages(): Promise<ContactMessage[]> {
  const { data, error } = await supabase.rpc('admin_list_contact_messages');

  if (error) {
    console.error('[Contact] fetch failed:', {
      message: error.message, code: error.code, details: error.details, hint: error.hint,
    });
    throw error;
  }
  return (data as ContactMessage[]) || [];
}

// Update the status of a message (admin panel).
export async function updateContactMessageStatus(
  id: number,
  status: ContactMessageStatus
): Promise<void> {
  requireOnlineConnection();
  const { error } = await supabase.rpc('admin_set_contact_message_status', {
    p_id: id,
    p_status: status,
  });

  if (error) {
    console.error('[Contact] status update failed:', {
      message: error.message, code: error.code, details: error.details, hint: error.hint,
    });
    throw error;
  }
}

export async function deleteContactMessage(id: number): Promise<void> {
  requireOnlineConnection();
  const { data, error } = await supabase.rpc('admin_delete_contact_message', {
    p_id: id,
  });
  if (error) throw error;
  if (!data) throw new Error('لم يتم حذف الاقتراح من قاعدة البيانات.');
}
