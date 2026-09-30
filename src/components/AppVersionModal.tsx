import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CalendarDays, ChevronLeft, ChevronRight, List, X } from 'lucide-react';
import { APP_RELEASES, APP_VERSION, APP_VERSION_DATE, getLatestVersion } from '../lib/appVersion';

export interface AppVersionAnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface AppVersionModalProps {
  open: boolean;
  onClose: () => void;
  anchorRect?: AppVersionAnchorRect | null;
  hasUpdate?: boolean;
  onUpdateAccepted?: () => void;
}

const glassStyle = {
  background: 'linear-gradient(145deg, color-mix(in srgb, var(--theme-primary) 22%, var(--theme-surface)), color-mix(in srgb, var(--theme-background) 92%, var(--theme-primary-dark) 8%))',
  borderColor: 'color-mix(in srgb, var(--theme-primary) 42%, var(--theme-border))',
  boxShadow: '0 24px 70px -30px var(--theme-shadow), inset 0 1px 0 color-mix(in srgb, var(--theme-surface) 14%, transparent)',
  backdropFilter: 'blur(22px) saturate(135%)',
  WebkitBackdropFilter: 'blur(22px) saturate(135%)',
} as const;

const releaseCardStyle = {
  background: 'linear-gradient(145deg, color-mix(in srgb, var(--theme-primary) 14%, var(--theme-surface)), color-mix(in srgb, var(--theme-surface-alt) 72%, transparent))',
  borderColor: 'color-mix(in srgb, var(--theme-primary) 24%, var(--theme-border))',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--theme-surface) 12%, transparent)',
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export default function AppVersionModal({ open, onClose, anchorRect }: AppVersionModalProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [viewport, setViewport] = useState({
    width: typeof window === 'undefined' ? 1024 : window.innerWidth,
    height: typeof window === 'undefined' ? 768 : window.innerHeight,
  });
  const popoverRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) {
      setShowHistory(false);
      return;
    }
    void getLatestVersion().catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const updateViewport = () => {
      const next = { width: window.innerWidth, height: window.innerHeight };
      setViewport(previous => previous.width === next.width && previous.height === next.height ? previous : next);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
    };
  }, [open]);

  const closePopover = useCallback(() => {
    setShowHistory(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handleOutsidePointer = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (popoverRef.current?.contains(target)) return;
      if (target?.closest('[data-wisal-version-trigger]')) return;
      closePopover();
    };
    document.addEventListener('mousedown', handleOutsidePointer);
    return () => document.removeEventListener('mousedown', handleOutsidePointer);
  }, [closePopover, open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showHistory) setShowHistory(false);
      else closePopover();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [closePopover, open, showHistory]);

  const releases = useMemo(() => [...APP_RELEASES].reverse(), []);
  const isWide = viewport.width >= 1024;
  const mainWidth = Math.min(286, Math.max(220, viewport.width - 24));
  const containerWidth = mainWidth
  const defaultLeft = (viewport.width - containerWidth) / 2;
  const preferredRight = anchorRect ? anchorRect.right + 10 : defaultLeft;
  const preferredLeft = anchorRect ? anchorRect.left - containerWidth - 10 : defaultLeft;
  const canOpenRight = preferredRight + containerWidth <= viewport.width - 12;
  const canOpenLeft = preferredLeft >= 12;
  const shouldStackBelow = Boolean(anchorRect && !isWide && !canOpenRight && !canOpenLeft);
  const left = anchorRect
    ? shouldStackBelow
      ? clamp((viewport.width - containerWidth) / 2, 12, viewport.width - containerWidth - 12)
      : canOpenRight
        ? preferredRight
        : canOpenLeft
          ? preferredLeft
          : clamp(preferredRight, 12, viewport.width - containerWidth - 12)
    : clamp(defaultLeft, 12, viewport.width - containerWidth - 12);
  const reservedHeight = 282;
  const preferredTop = shouldStackBelow ? (anchorRect?.bottom ?? 72) + 10 : (anchorRect?.top ?? 72);
  const top = clamp(preferredTop, 12, viewport.height - reservedHeight - 12);
  const motionDuration = shouldReduceMotion ? 0 : 0.28;

  return (
    <AnimatePresence>
      {open && (
        <div ref={popoverRef} className="pointer-events-none fixed inset-0 z-[80]" dir="rtl">
          <div
            className={`pointer-events-none absolute flex max-h-[calc(100dvh-1.5rem)] flex-col gap-2 ${showHistory && isWide ? 'lg:flex-row' : ''}`}
            style={{ left, top, width: containerWidth }}
            dir="ltr"
          >
            <motion.section
              role="dialog"
              dir="rtl"
              aria-modal="true"
              aria-labelledby="wisal-version-title"
              initial={{ opacity: 0, scale: 0.96, x: -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.97, x: -6 }}
              transition={{ duration: motionDuration, ease: 'easeOut' }}
              className="pointer-events-auto relative flex h-[282px] min-h-[282px] max-h-[282px] w-full flex-col overflow-hidden rounded-[24px] border p-4 text-[var(--theme-text)]"
              style={{ ...glassStyle, width: mainWidth, willChange: 'transform, opacity', contain: 'layout paint' }}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="إغلاق"
                onClick={closePopover}
                className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-primary-soft)] text-[var(--theme-muted)] transition hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <AnimatePresence initial={false} mode="wait">
                {showHistory ? (
                  <motion.div
                    key="history"
                    className="flex min-h-0 flex-1 flex-col"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: motionDuration, ease: 'easeOut' }}
                  >
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        aria-label="العودة إلى الإصدار الحالي"
                        onClick={() => setShowHistory(false)}
                        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-primary-soft)] text-[var(--theme-muted)] transition hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <h2 id="wisal-version-title" className="text-base font-black text-[var(--theme-text)]">جميع إصدارات وصال</h2>
                    </div>

                    <ol id="wisal-release-history" className="mt-4 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'color-mix(in srgb, var(--theme-primary) 42%, transparent) transparent' }}>
                      {releases.map((release, index) => {
                        const isCurrent = release.version === APP_VERSION;
                        const isLast = index === releases.length - 1;
                        return (
                          <li key={release.version} className="relative flex gap-2">
                            <div className="relative flex w-4 shrink-0 justify-center">
                              {!isLast && <span className="absolute top-3.5 h-[calc(100%+0.375rem)] w-px bg-[var(--accent-primary)]/30" />}
                              <span className={isCurrent
                                ? 'relative z-10 mt-2.5 h-3 w-3 rounded-full border-2 border-[var(--accent-primary)] bg-[var(--accent-primary)] shadow-[0_0_14px_var(--accent-primary)]'
                                : 'relative z-10 mt-2.5 h-3 w-3 rounded-full border-2 border-[var(--theme-border)] bg-[var(--theme-surface-alt)]'} />
                            </div>
                            <div
                              className={isCurrent
                                ? 'min-w-0 flex-1 rounded-xl border border-[var(--accent-primary)]/55 bg-[var(--accent-primary)]/15 p-2'
                                : 'min-w-0 flex-1 rounded-xl border p-2'}
                              style={isCurrent ? undefined : releaseCardStyle}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={isCurrent ? 'text-xl font-black text-[var(--accent-primary)]' : 'text-xl font-black text-[var(--theme-text)]'} dir="ltr">{release.version}</span>
                                {isCurrent && <span className="rounded-full bg-[var(--accent-primary)] px-1.5 py-0.5 text-[9px] font-black text-[var(--theme-text)]">الحالي</span>}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-[var(--theme-muted)]" dir="ltr">
                                <CalendarDays className="h-3 w-3 text-[var(--accent-primary)]" />
                                {release.date}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </motion.div>
                ) : (
                  <motion.div
                    key="current"
                    className="flex min-h-0 flex-1 flex-col"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: motionDuration, ease: 'easeOut' }}
                  >
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-alt)]">
                        <img
                          src={(import.meta as any).env.BASE_URL + 'favicon.png'}
                          alt="WISAL"
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      </div>
                      <h2 id="wisal-version-title" className="text-base font-black text-[var(--theme-text)]">إصدارات وصال</h2>
                    </div>

                    <div className="mt-4 text-center">
                      <p className="text-[1.65rem] font-black tracking-[0.22em] text-[var(--theme-text)]" dir="ltr">WISAL</p>
                      <p className="mt-0.5 text-6xl font-black leading-none text-[var(--accent-primary)]" dir="ltr">{APP_VERSION}</p>
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--theme-muted)]" dir="ltr">
                        <CalendarDays className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        {APP_VERSION_DATE}
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-expanded={showHistory}
                      aria-controls="wisal-release-history"
                      onClick={() => setShowHistory(true)}
                      className="mt-4 flex w-full items-center gap-2 rounded-xl border p-2.5 text-right transition duration-300 hover:-translate-y-0.5 hover:border-[var(--accent-primary)]/65 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                      style={releaseCardStyle}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)]/18 text-[var(--accent-primary)]">
                        <List className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-sm font-black text-[var(--theme-text)]">الإصدارات السابقة</span>
                      <ChevronLeft className="h-4 w-4 shrink-0 text-[var(--theme-text)]/55" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}