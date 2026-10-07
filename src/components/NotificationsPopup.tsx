import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Clock } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'all' | 'offer' | 'news' | 'update'>('all');
  const visibleNotifications = activeTab === 'all' ? notifications : notifications.filter(item => item.notification_type === activeTab);
  const tabs = [{ value: 'all', label: 'الكل' }, { value: 'offer', label: 'العروض' }, { value: 'news', label: 'الأخبار' }, { value: 'update', label: 'التحديثات' }] as const;

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
  }, [notifications, activeTab, loading, error, markRead]);

  return (
    <MenuSubmenuPopover
      open
      onClose={onClose}
      anchorRect={anchorRect}
      title="الإشعارات"
      ariaLabel="الإشعارات"
      dialogRef={dialogRef}
      closeButtonRef={closeRef}
      size="large"
      appearance="clean"
      headerIcon={<Bell className="h-6 w-6 shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />}
      scrollContent={false}
    >
      <p className="mb-5 text-center text-xs leading-6 text-[var(--theme-muted)] sm:text-sm">جديد وصال من العروض والتنبيهات</p>
      <div role="tablist" aria-label="أنواع الإشعارات" className="mb-4 grid shrink-0 grid-cols-4 gap-1.5 sm:gap-2">
        {tabs.map(({ label, value }) => (
          <button key={value} type="button" role="tab" aria-selected={activeTab === value} data-notification-tab={value}
            onClick={() => { setActiveTab(value); if (listRef.current) listRef.current.scrollTop = 0; }}
            className={`flex min-h-11 items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold sm:text-sm ${activeTab === value ? 'app-btn-accent shadow-sm' : 'bg-[var(--theme-primary-soft)] text-[var(--theme-muted)] disabled:cursor-default'}`}>
            {label}
            {value === 'all' && !loading && !error && notifications.length > 0 && <span dir="ltr" className="rounded-full bg-[var(--theme-surface)] px-1.5 text-[10px] text-[var(--accent-primary)]">{notifications.length}</span>}
          </button>
        ))}
      </div>
      <div ref={listRef} tabIndex={0} aria-label="إشعارات الإدارة" className="min-h-0 flex-1 overflow-y-auto">
        {loading ? <p role="status" className="p-6 text-center text-[var(--theme-muted)]">جاري تحميل الإشعارات...</p>
          : error ? <div role="alert" className="p-6 text-center text-[var(--theme-muted)]">
            <p>{error}</p>
            <button type="button" onClick={refresh} className="mt-3 font-bold text-[var(--accent-primary)]">إعادة المحاولة</button>
          </div>
          : visibleNotifications.length === 0 ? <div className="flex min-h-52 flex-col items-center justify-center gap-3 p-8 text-center text-[var(--theme-muted)]"><BellOff className="h-10 w-10 opacity-40" aria-hidden="true" /><p className="text-sm font-bold">{activeTab === 'all' ? 'لا توجد إشعارات حالياً' : 'لا توجد إشعارات من هذا النوع حالياً'}</p></div>
          : visibleNotifications.map(notification => (
            <article key={notification.id} data-notification-id={notification.id}
              className="mb-3 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 text-right shadow-sm">
              <div className="flex items-start gap-2">
                <h3 className="min-w-0 flex-1 break-words font-bold text-[var(--theme-text)]">{notification.title}</h3>
                {!readIds.has(notification.id) && <span className="shrink-0 text-xs text-[var(--accent-primary)]">جديد</span>}
              </div>
              <p className="mt-2 break-words whitespace-pre-wrap text-sm text-[var(--theme-muted)]">{notification.message}</p>
              <time dateTime={notification.published_at!} className="mt-3 flex items-center gap-1 text-xs text-[var(--theme-muted)]">
                <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                {new Date(notification.published_at!).toLocaleString('ar-IQ', { numberingSystem: 'latn' })}
              </time>
            </article>
          ))}
      </div>
    </MenuSubmenuPopover>
  );
}
