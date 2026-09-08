import { useEffect, useRef } from 'react';
import { Clock, X } from 'lucide-react';
import { motion } from 'motion/react';
import { AdminNotification } from '../lib/notifications';
import { useModalScrollLock } from '../hooks/useModalScrollLock';

interface Props {
  onClose: () => void;
  notifications: AdminNotification[];
  loading: boolean;
  error: string;
  readIds: Set<string>;
  markRead: (id: string) => void;
  refresh: () => void;
}

export default function NotificationsPopup({ onClose, notifications, loading, error, readIds, markRead, refresh }: Props) {
  useModalScrollLock();
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (previousFocus?.isConnected) previousFocus.focus();
      else document.querySelector<HTMLButtonElement>('[aria-controls="main-menu"]')?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (loading || error || !listRef.current) return;
    // Count only items that enter the popup's scroll viewport as read.
    const observer = new IntersectionObserver(entries => {
      if (document.hidden) return;
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = (entry.target as HTMLElement).closest<HTMLElement>('[data-notification-id]')?.dataset.notificationId;
          if (id) markRead(id);
          observer.unobserve(entry.target);
        }
      });
    }, { root: listRef.current, threshold: 0.1 });
    // Observe the title, so very long messages can be read even on short screens.
    const observeTitles = () => listRef.current?.querySelectorAll('[data-notification-id] h3').forEach(item => observer.observe(item));
    const handleVisibility = () => { if (!document.hidden) observeTitles(); };
    observeTitles();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [notifications, loading, error, markRead]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="notifications-title" dir="rtl"
        initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md max-h-[85dvh] flex flex-col border rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden bg-[var(--surface-elevated)] border-[var(--border)]">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <h2 id="notifications-title" className="text-lg font-bold text-[var(--text-primary)]">الإشعارات</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="إغلاق الإشعارات"
            className="p-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--accent-soft)]"><X className="w-5 h-5" /></button>
        </div>
        <div ref={listRef} tabIndex={0} aria-label="إشعارات الإدارة" className="min-h-0 max-h-[500px] overflow-y-auto">
          {loading ? <p role="status" className="p-6 text-center text-[var(--text-muted)]">جاري تحميل الإشعارات...</p>
            : error ? <div role="alert" className="p-6 text-center text-[var(--text-muted)]">
              <p>{error}</p><button type="button" onClick={refresh} className="mt-3 font-bold text-[var(--accent-primary)]">إعادة المحاولة</button>
            </div>
            : notifications.length === 0 ? <p className="p-8 text-center text-[var(--text-muted)]">لا توجد إشعارات جديدة</p>
            : notifications.map(notification => (
              <article key={notification.id} data-notification-id={notification.id}
                className="p-4 text-right border-b border-[var(--border)] last:border-0">
                <div className="flex items-start gap-2">
                  <h3 className="min-w-0 break-words flex-1 font-bold text-[var(--text-primary)]">{notification.title}</h3>
                  {!readIds.has(notification.id) && <span className="shrink-0 text-xs text-blue-500">جديد</span>}
                </div>
                <p className="text-sm text-[var(--text-secondary)] mt-2 whitespace-pre-wrap break-words">{notification.message}</p>
                <time dateTime={notification.published_at!} className="mt-3 text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                  {new Date(notification.published_at!).toLocaleString('ar-IQ')}
                </time>
              </article>
            ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
