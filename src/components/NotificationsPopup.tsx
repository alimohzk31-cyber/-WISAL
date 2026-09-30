import { useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import type { AdminNotification } from '../lib/notifications';
import MenuSubmenuPopover from './MenuSubmenuPopover';
import type { MenuPopoverAnchorRect } from './MenuSubmenuPopover';

interface Props {
  onClose: () => void;
  notifications: AdminNotification[];
  loading: boolean;
  error: string;
  readIds: Set<string>;
  markRead: (id: string) => void;
  refresh: () => void;
  anchorRect?: MenuPopoverAnchorRect | null;
}

export default function NotificationsPopup({
  onClose,
  notifications,
  loading,
  error,
  readIds,
  markRead,
  refresh,
  anchorRect,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      if (previousFocus?.isConnected) previousFocus.focus();
      else document.querySelector<HTMLButtonElement>('[aria-controls="main-menu"]')?.focus();
    };
  }, []);

  useEffect(() => {
    if (loading || error || !listRef.current) return;
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
    <MenuSubmenuPopover
      open
      onClose={onClose}
      anchorRect={anchorRect}
      title="الإشعارات"
      ariaLabel="الإشعارات"
      dialogRef={dialogRef}
      closeButtonRef={closeRef}
      scrollContent={false}
    >
      <div ref={listRef} tabIndex={0} aria-label="إشعارات الإدارة" className="min-h-0 flex-1 overflow-y-auto">
        {loading ? <p role="status" className="p-6 text-center text-[var(--theme-muted)]">جاري تحميل الإشعارات...</p>
          : error ? <div role="alert" className="p-6 text-center text-[var(--theme-muted)]">
            <p>{error}</p>
            <button type="button" onClick={refresh} className="mt-3 font-bold text-[var(--accent-primary)]">إعادة المحاولة</button>
          </div>
          : notifications.length === 0 ? <p className="p-8 text-center text-[var(--theme-muted)]">لا توجد إشعارات جديدة</p>
          : notifications.map(notification => (
            <article key={notification.id} data-notification-id={notification.id}
              className="border-b border-[var(--theme-border)] p-3 text-right last:border-0">
              <div className="flex items-start gap-2">
                <h3 className="min-w-0 flex-1 break-words font-bold text-[var(--theme-text)]">{notification.title}</h3>
                {!readIds.has(notification.id) && <span className="shrink-0 text-xs text-[var(--accent-primary)]">جديد</span>}
              </div>
              <p className="mt-2 break-words whitespace-pre-wrap text-sm text-[var(--theme-muted)]">{notification.message}</p>
              <time dateTime={notification.published_at!} className="mt-3 flex items-center gap-1 text-xs text-[var(--theme-muted)]">
                <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                {new Date(notification.published_at!).toLocaleString('ar-IQ')}
              </time>
            </article>
          ))}
      </div>
    </MenuSubmenuPopover>
  );
}