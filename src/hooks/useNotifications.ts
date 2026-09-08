import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminNotification, fetchNotifications, NOTIFICATION_READ_KEY, NOTIFICATIONS_CHANGED, parseReadNotificationIds, unreadNotificationCount } from '../lib/notifications';

export function useNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try { return parseReadNotificationIds(localStorage.getItem(NOTIFICATION_READ_KEY)); }
    catch { return new Set(); }
  });
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let refreshAgain = false;
    const refresh = async () => {
      if (inFlight) { refreshAgain = true; return; }
      inFlight = true;
      try {
        const rows = await fetchNotifications();
        if (active) { setNotifications(rows); setError(''); }
      } catch {
        if (active) setError('تعذر تحميل الإشعارات. حاول مرة أخرى.');
      } finally {
        inFlight = false;
        if (active) {
          setLoading(false);
          if (refreshAgain) { refreshAgain = false; void refresh(); }
        }
      }
    };
    const refreshVisible = () => { if (!document.hidden) void refresh(); };
    const syncRead = (event: StorageEvent) => {
      if (event.key === NOTIFICATION_READ_KEY || event.key === null) setReadIds(parseReadNotificationIds(event.newValue));
    };
    refreshRef.current = refresh;
    void refresh();
    const timer = window.setInterval(refreshVisible, 30000);
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('online', refreshVisible);
    window.addEventListener(NOTIFICATIONS_CHANGED, refreshVisible);
    window.addEventListener('storage', syncRead);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('online', refreshVisible);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refreshVisible);
      window.removeEventListener('storage', syncRead);
      document.removeEventListener('visibilitychange', refreshVisible);
    };
  }, []);

  const markRead = useCallback((id: string) => {
    setReadIds(previous => {
      if (previous.has(id)) return previous;
      let stored = new Set<string>();
      try { stored = parseReadNotificationIds(localStorage.getItem(NOTIFICATION_READ_KEY)); } catch { /* Memory fallback. */ }
      const next = new Set([...previous, ...stored, id]);
      try { localStorage.setItem(NOTIFICATION_READ_KEY, JSON.stringify([...next])); } catch { /* Reading still works if storage is unavailable. */ }
      return next;
    });
  }, []);
  const refresh = useCallback(() => refreshRef.current(), []);
  return { notifications, loading, error, readIds, markRead, refresh, unreadCount: unreadNotificationCount(notifications, readIds) };
}
