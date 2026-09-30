import type { ReactNode, RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

export interface MenuPopoverAnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRect?: MenuPopoverAnchorRect | null;
  title: string;
  ariaLabel: string;
  children: ReactNode;
  headerAction?: ReactNode;
  triggerSelector?: string;
  dialogRef?: RefObject<HTMLDivElement | null>;
  closeButtonRef?: RefObject<HTMLButtonElement | null>;
  scrollContent?: boolean;
  size?: 'compact' | 'large';
}

const glassStyle = {
  background: 'linear-gradient(145deg, color-mix(in srgb, var(--theme-primary) 22%, var(--theme-surface)), color-mix(in srgb, var(--theme-background) 92%, var(--theme-primary-dark) 8%))',
  borderColor: 'color-mix(in srgb, var(--theme-primary) 42%, var(--theme-border))',
  boxShadow: '0 24px 70px -30px var(--theme-shadow), inset 0 1px 0 color-mix(in srgb, var(--theme-surface) 14%, transparent)',
  backdropFilter: 'blur(22px) saturate(135%)',
  WebkitBackdropFilter: 'blur(22px) saturate(135%)',
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export default function MenuSubmenuPopover({
  open,
  onClose,
  anchorRect,
  title,
  ariaLabel,
  children,
  headerAction,
  triggerSelector = '[data-wisal-submenu-trigger]',
  dialogRef,
  closeButtonRef,
  scrollContent = true,
  size = 'compact',
}: Props) {
  const readViewport = () => ({
    width: typeof window === 'undefined' ? 1024 : window.visualViewport?.width ?? window.innerWidth,
    height: typeof window === 'undefined' ? 768 : window.visualViewport?.height ?? window.innerHeight,
  });
  const [viewport, setViewport] = useState(readViewport);
  const shouldReduceMotion = useReducedMotion();
  const motionDuration = shouldReduceMotion ? 0 : 0.28;

  useEffect(() => {
    if (!open) return;
    const updateViewport = () => {
      const next = readViewport();
      setViewport(previous => previous.width === next.width && previous.height === next.height ? previous : next);
    };
    const visualViewport = window.visualViewport;
    updateViewport();
    window.addEventListener('resize', updateViewport);
    visualViewport?.addEventListener('resize', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      visualViewport?.removeEventListener('resize', updateViewport);
    };
  }, [open]);

  const closePopover = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;
    const handleOutsidePointer = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(triggerSelector)) return;
      closePopover();
    };
    document.addEventListener('mousedown', handleOutsidePointer);
    return () => document.removeEventListener('mousedown', handleOutsidePointer);
  }, [closePopover, open, triggerSelector]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePopover();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [closePopover, open]);

  const isLarge = size === 'large';
  const mainWidth = isLarge ? Math.min(720, Math.max(280, viewport.width - 24)) : Math.min(286, Math.max(220, viewport.width - 24));
  const popoverHeight = isLarge ? Math.max(220, Math.min(720, viewport.height - 24)) : 282;
  const defaultLeft = (viewport.width - mainWidth) / 2;
  const preferredRight = anchorRect ? anchorRect.right + 10 : defaultLeft;
  const preferredLeft = anchorRect ? anchorRect.left - mainWidth - 10 : defaultLeft;
  const canOpenRight = preferredRight + mainWidth <= viewport.width - 12;
  const canOpenLeft = preferredLeft >= 12;
  const shouldStackBelow = Boolean(anchorRect && viewport.width < 1024 && !canOpenRight && !canOpenLeft);
  const left = anchorRect
    ? shouldStackBelow
      ? clamp((viewport.width - mainWidth) / 2, 12, viewport.width - mainWidth - 12)
      : canOpenRight
        ? preferredRight
        : canOpenLeft
          ? preferredLeft
          : clamp(preferredRight, 12, viewport.width - mainWidth - 12)
    : clamp(defaultLeft, 12, viewport.width - mainWidth - 12);
  const top = clamp(
    shouldStackBelow ? (anchorRect?.bottom ?? 72) + 10 : anchorRect?.top ?? 72,
    12,
    viewport.height - popoverHeight - 12,
  );

  return (
    <AnimatePresence>
      {open && (
        <div className="pointer-events-none fixed inset-0 z-[80]" dir="rtl">
          <motion.section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            initial={{ opacity: 0, scale: 0.96, x: -8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.97, x: -6 }}
            transition={{ duration: motionDuration, ease: 'easeOut' }}
            className={isLarge ? "pointer-events-auto fixed flex w-full flex-col overflow-hidden rounded-[24px] border p-4 text-[var(--theme-text)]" : "pointer-events-auto fixed flex h-[282px] min-h-[282px] max-h-[282px] w-full flex-col overflow-hidden rounded-[24px] border p-4 text-[var(--theme-text)]"}
            style={{ ...glassStyle, left, top, width: mainWidth, height: isLarge ? popoverHeight : undefined, willChange: 'transform, opacity', contain: 'layout paint' }}
            onMouseDown={event => event.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="إغلاق"
              onClick={closePopover}
              className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--theme-border)] bg-[var(--theme-primary-soft)] text-[var(--theme-muted)] transition hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="relative flex shrink-0 items-center justify-center pb-2 pt-1">
                <h2 className="text-base font-black text-[var(--theme-text)]">{title}</h2>
                {headerAction}
              </div>
              <div
                className={scrollContent ? 'min-h-0 flex-1 overflow-y-auto pr-0.5' : 'flex min-h-0 flex-1 flex-col'}
                style={scrollContent ? { scrollbarWidth: 'thin', scrollbarColor: 'color-mix(in srgb, var(--theme-primary) 42%, transparent) transparent' } : undefined}
              >
                {children}
              </div>
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>
  );
}