import { supabase } from './supabase';
import { createRequestCache } from './requestCache';

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  published_at: string | null;
}

export const NOTIFICATIONS_CHANGED = 'saleen:notifications-changed';
export const NOTIFICATION_READ_KEY = 'saleen:notifications:read:v1';

export function parseReadNotificationIds(value: string | null): Set<string> {
  try {
    const ids: unknown = JSON.parse(value || '[]');
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
  } catch { return new Set(); }
}

export function unreadNotificationCount(items: AdminNotification[], readIds: Set<string>): number {
  return items.filter(item => item.published_at !== null && !readIds.has(item.id)).length;
}

const publishedRead = createRequestCache<AdminNotification[]>(10_000);
export function fetchNotifications(includeDrafts = false): Promise<AdminNotification[]> {
  // Admin drafts are never stored in the public cache.
  return includeDrafts ? loadNotifications(true) : publishedRead.get(() => loadNotifications(false));
}

async function loadNotifications(includeDrafts: boolean): Promise<AdminNotification[]> {
  const items: AdminNotification[] = [];
  // Paginate so unread counts aren't silently capped by the API row limit.
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from('admin_notifications')
      .select('id,title,message,created_at,published_at')
      .order('published_at', { ascending: false, nullsFirst: true })
      .order('id', { ascending: false })
      .range(offset, offset + 499);
    if (!includeDrafts) query = query.not('published_at', 'is', null);
    const { data, error } = await query;
    if (error) throw error;
    items.push(...(data as AdminNotification[]));
    if (data.length < 500) return items;
  }
}

export function notifyNotificationsChanged() {
  publishedRead.invalidate();
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}
