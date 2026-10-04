import { menuPanelLayout } from './menuPanelLayout';
import { Palette, Check, ArrowLeft } from 'lucide-react';
import { useTheme, Theme, SELECTABLE_THEMES } from '../context/ThemeContext';
import { useState, useRef, useEffect, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

interface ThemeOption {
  id: Theme;
  label: string;
  swatch: string;
}

// قائمة الثيمات المعروضة في أيقونة الألوان (قابلة للتوسعة — أضف الثيم هنا فقط
// بعد إضافة كتلة CSS الخاصة به في index.css وألوانه في PRIMARY_COLORS)
const THEME_LABELS: Record<string, string> = {
  light: 'Light',
  royal: 'Royal Purple',
  red: '🔴 الأبيض والأحمر',
  blue: 'السماوي / الأزرق',
  green: 'الأخضر',
  pink: 'الوردي',
  maroon: 'الرماني / الطماطي',
};

const THEME_SWATCHES: Record<string, string> = {
  light: '#DAD7D2',
  royal: '#6A0DAD',
  red: '#D90429',
  blue: '#087CFF',
  green: '#20E7AD',
  pink: '#FF4EAC',
  maroon: '#FF2C91',
};

const THEME_OPTIONS: ThemeOption[] = SELECTABLE_THEMES.map((id) => ({
  id,
  label: THEME_LABELS[id] ?? id,
  swatch: THEME_SWATCHES[id] ?? '#888888',
}));

interface ThemePopoverAnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface ThemeToggleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  scope?: 'browse' | 'admin';
  popover?: boolean;
  anchorRect?: ThemePopoverAnchorRect | null;
  onClose?: () => void;
}

export default function ThemeToggle({ open, onOpenChange, hideTrigger = false, scope = 'browse', popover = false, anchorRect = null, onClose }: ThemeToggleProps) {
  const { theme, setTheme, adminTheme, setAdminTheme } = useTheme();
  const selectedTheme = scope === 'admin' ? adminTheme : theme;
  const selectTheme = scope === 'admin' ? setAdminTheme : setTheme;
  const [internalOpen, setInternalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Controlled ↔ uncontrolled pattern: when `open`/`onOpenChange` are
  // supplied the parent owns the state; otherwise the component is
  // self-contained (backward compatible with existing standalone usage).
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  const closePopover = useCallback((event?: ReactMouseEvent<HTMLElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (onClose) onClose();
    else setIsOpen(false);
  }, [onClose, setIsOpen]);
  const shouldReduceMotion = useReducedMotion();
  const motionDuration = shouldReduceMotion ? 0 : 0.28;

  const [viewport, setViewport] = useState({
    width: typeof window === 'undefined' ? 1024 : window.innerWidth,
    height: typeof window === 'undefined' ? 768 : window.innerHeight,
  });

  useEffect(() => {
    if (!popover || !isOpen) return;
    const updateViewport = () => {
      const next = { width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight };
      setViewport(previous => previous.width === next.width && previous.height === next.height ? previous : next);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
    };
  }, [isOpen, popover]);
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element | null;
      if (popover && target?.closest('[data-wisal-colors-trigger]')) return;
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, popover, setIsOpen]);

  useEffect(() => {
    if (!popover || !isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, popover, setIsOpen]);

  const panelLayout = menuPanelLayout(viewport, anchorRect);

  return (
    <div className={popover ? "pointer-events-none fixed inset-0 z-[80]" : "relative w-full max-w-56"} ref={dropdownRef} dir="rtl">
      {!hideTrigger && (
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="p-2 rounded-xl transition-colors border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
          title="ألوان التطبيق"
          aria-label="ألوان التطبيق"
        >
          <Palette className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role={popover ? "dialog" : undefined}
            aria-label={popover ? "ألوان وصال" : undefined}
            initial={{ opacity: 0, y: popover ? 0 : 8, x: popover ? -8 : 0, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: popover ? 0 : 8, x: popover ? -6 : 0, scale: 0.96 }}
            className={
              popover
                ? "pointer-events-auto fixed flex flex-col overflow-hidden rounded-[24px] border p-4 text-[var(--theme-text)]"
                : hideTrigger
                  ? "z-50 w-full min-w-0 max-w-56 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-lg)]"
                  : "absolute left-0 z-50 mt-2 w-56 min-w-0 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-lg)]"
            }
            transition={popover ? { duration: motionDuration, ease: 'easeOut' } : undefined}
            onMouseDown={popover ? event => event.stopPropagation() : undefined}
            onClick={popover ? event => event.stopPropagation() : undefined}
            style={popover ? {
              ...panelLayout,
              background: 'linear-gradient(145deg, color-mix(in srgb, var(--theme-primary) 22%, var(--theme-surface)), color-mix(in srgb, var(--theme-background) 92%, var(--theme-primary-dark) 8%))',
              borderColor: 'color-mix(in srgb, var(--theme-primary) 42%, var(--theme-border))',
              boxShadow: '0 24px 70px -30px var(--theme-shadow), inset 0 1px 0 color-mix(in srgb, var(--theme-surface) 14%, transparent)',
              backdropFilter: 'blur(22px) saturate(135%)',
              WebkitBackdropFilter: 'blur(22px) saturate(135%)',
              willChange: 'transform, opacity',
              contain: 'layout paint',
            } : undefined}
          >
            {popover && (
              <div className="relative flex items-center justify-center pb-2 pt-1">
                <h2 className="text-base font-black text-[var(--theme-text)]">{'\u0623\u0644\u0648\u0627\u0646 \u0648\u0635\u0627\u0644'}</h2>
                <button
                  type="button"
                  aria-label="العودة إلى القائمة الرئيسية"
                  onClick={closePopover}
                  className="absolute left-0 top-0 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-primary-soft)] text-[var(--theme-muted)] transition hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className={popover ? "min-h-0 flex-1 overflow-y-auto pr-0.5" : "p-2 space-y-1"} style={popover ? { scrollbarWidth: 'thin', scrollbarColor: 'color-mix(in srgb, var(--theme-primary) 42%, transparent) transparent' } : undefined}>
              <div className={popover ? "space-y-1.5" : "space-y-1"}>
              {(scope === 'admin' ? [
                { id: 'light' as Theme, label: '☀️ الوضع الفاتح / Light', swatch: '#f5f7fc' },
                { id: 'dark' as Theme, label: '🌙 الوضع الغامق / Dark', swatch: '#07111f' },
              ] : THEME_OPTIONS).map((item) => {
                const isActive = selectedTheme === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      selectTheme(item.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                      isActive
                        ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={popover ? "h-4 w-4 rounded-full border border-[var(--border)]" : "w-5 h-5 rounded-full border border-[var(--border)]"}
                        style={{ backgroundColor: item.swatch }}
                      />
                      <span className="min-w-0 break-words text-sm font-medium">{item.label}</span>
                    </div>
                    {isActive && (
                      <Check className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                    )}
                  </button>
                );
              })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
