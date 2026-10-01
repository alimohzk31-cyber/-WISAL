import { MessageSquareWarning, Menu, Palette, Bell, PackageCheck } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
const SuggestionsFeedModal = lazy(() => import('./SuggestionsFeedModal'));
import NotificationsPopup from './NotificationsPopup';
const AppVersionModal = lazy(() => import('./AppVersionModal'));
import type { MenuPopoverAnchorRect } from './MenuSubmenuPopover';
import { APP_VERSION, checkForUpdate } from '../lib/appVersion';
import { useNotifications } from '../hooks/useNotifications';
import ThemeToggle from './ThemeToggle';
import { AnimatePresence, motion } from 'motion/react';

export default function MainMenuController() {
  type MenuSubmenu = 'notifications' | 'suggestions' | 'colors' | 'version';
  const [openSubmenu, setOpenSubmenu] = useState<MenuSubmenu | null>(null);
  const [submenuAnchorRect, setSubmenuAnchorRect] = useState<MenuPopoverAnchorRect | null>(null);
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const notifications = useNotifications();
  const closeSubmenu = useCallback(() => {
    setOpenSubmenu(null);
    setSubmenuAnchorRect(null);
  }, []);
  const mainMenuRef = useRef<HTMLDivElement>(null);
  const mainMenuPanelRef = useRef<HTMLDivElement>(null);
  const versionTriggerRef = useRef<HTMLButtonElement>(null);
  const colorsTriggerRef = useRef<HTMLButtonElement>(null);
  const notificationsTriggerRef = useRef<HTMLButtonElement>(null);
  const suggestionsTriggerRef = useRef<HTMLButtonElement>(null);
  const suggestionsMountedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void checkForUpdate().then(result => {
      if (!cancelled) setHasUpdate(result.hasUpdate);
    });
    return () => { cancelled = true; };
  }, []);

  const toggleSubmenu = useCallback((submenu: MenuSubmenu, triggerRef: React.RefObject<HTMLButtonElement | null>) => {
    if (openSubmenu === submenu) {
      closeSubmenu();
      return;
    }
    const menuRect = mainMenuPanelRef.current?.getBoundingClientRect() ?? mainMenuRef.current?.getBoundingClientRect();
    const triggerRect = triggerRef.current?.getBoundingClientRect() ?? menuRect;
    const rect = triggerRect ?? menuRect;
    if (rect) {
      const horizontalRect = menuRect ?? rect;
      setSubmenuAnchorRect({ top: rect.top, left: horizontalRect.left, right: horizontalRect.right, bottom: rect.bottom, width: horizontalRect.width, height: rect.height });
    }
    setOpenSubmenu(submenu);
  }, [closeSubmenu, openSubmenu]);

  const handleNotificationsOpen = useCallback(() => toggleSubmenu('notifications', notificationsTriggerRef), [toggleSubmenu]);
  const handleSuggestionsOpen = useCallback(() => {
    suggestionsMountedRef.current = true;
    toggleSubmenu('suggestions', suggestionsTriggerRef);
  }, [toggleSubmenu]);
  const handleColorsOpen = useCallback(() => toggleSubmenu('colors', colorsTriggerRef), [toggleSubmenu]);
  const handleAppVersionOpen = useCallback(() => toggleSubmenu('version', versionTriggerRef), [toggleSubmenu]);
  const handleColorsOpenChange = useCallback((open: boolean) => {
    if (!open) closeSubmenu();
  }, [closeSubmenu]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mainMenuRef.current && !mainMenuRef.current.contains(event.target as Node)) {
        setShowMainMenu(false);
        closeSubmenu();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeSubmenu]);

  return (
    <>
          {/* Left: ☰ Main Menu — 5 items, Admin outside */}
          <div className="relative" ref={mainMenuRef}>
            <button
              type="button"
              onClick={() => setShowMainMenu(value => { if (value) closeSubmenu(); return !value; })}
              aria-label="القائمة الرئيسية"
              aria-expanded={showMainMenu}
              aria-controls="main-menu"
              className="p-2 rounded-xl transition-colors border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)]"
            >
              <Menu className="w-6 h-6" />
            </button>

            <AnimatePresence>
              {showMainMenu && (
                <motion.div
                  ref={mainMenuPanelRef}
                  id="main-menu"
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="absolute left-0 z-50 mt-2 w-60 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2 shadow-[var(--shadow-lg)]"
                >
                  <button
                    type="button"
                    ref={notificationsTriggerRef}
                    data-wisal-submenu-trigger="true"
                    onClick={handleNotificationsOpen}
                    aria-haspopup="dialog"
                    aria-label={notifications.unreadCount > 0 ? 'الإشعارات، ' + notifications.unreadCount + ' غير مقروءة' : 'الإشعارات'}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-blue-500/10"
                  >
                    <span className="relative shrink-0">
                      <Bell className="h-5 w-5 text-blue-500" strokeWidth={1.8} aria-hidden="true" />
                      {notifications.unreadCount > 0 && (
                        <span aria-hidden="true" className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] leading-none font-bold text-white ring-2 ring-[var(--surface-elevated)]">
                          {notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}
                        </span>
                      )}
                    </span>
                    الإشعارات
                  </button>
                  <button
                    type="button"
                    ref={suggestionsTriggerRef}
                    data-wisal-submenu-trigger="true"
                    onClick={handleSuggestionsOpen}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-teal-500/10"
                  >
                    <MessageSquareWarning className="h-5 w-5 text-teal-500" />
                    الاقتراحات والشكاوى
                  </button>
                  <button
                    type="button"
                    ref={colorsTriggerRef}
                    data-wisal-colors-trigger="true"
                    onClick={handleColorsOpen}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--accent-soft)]"
                  >
                    <Palette className="h-5 w-5" style={{ color: 'var(--accent-primary)' }} />
                    الألوان
                  </button>
                  <button
                    ref={versionTriggerRef}
                    data-wisal-version-trigger="true"
                    type="button"
                    onClick={handleAppVersionOpen}
                    aria-haspopup="dialog"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-emerald-500/10"
                  >
                    <span className="relative shrink-0">
                      <PackageCheck className="h-5 w-5 text-emerald-500" strokeWidth={1.8} aria-hidden="true" />
                      {hasUpdate && (
                        <span aria-hidden="true" className="absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 ring-2 ring-[var(--surface-elevated)]">
                          <span className="h-1 w-1 rounded-full bg-white" />
                        </span>
                      )}
                    </span>
                    الإصدار
                    <span className="mr-auto text-[10px] font-bold text-[var(--text-muted)]" dir="ltr">{APP_VERSION}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

      <Suspense fallback={null}>
        {suggestionsMountedRef.current && <SuggestionsFeedModal open={openSubmenu === 'suggestions'} onClose={closeSubmenu} anchorRect={submenuAnchorRect} />}
        {openSubmenu === 'notifications' && <NotificationsPopup {...notifications} onClose={closeSubmenu} anchorRect={submenuAnchorRect} />}
        {openSubmenu === 'colors' && <ThemeToggle open onOpenChange={handleColorsOpenChange} onClose={closeSubmenu} hideTrigger popover anchorRect={submenuAnchorRect} />}
        {openSubmenu === 'version' && <AppVersionModal open onClose={closeSubmenu} anchorRect={submenuAnchorRect} hasUpdate={hasUpdate} onUpdateAccepted={() => setHasUpdate(false)} />}
      </Suspense>
    </>
  );
}
