import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: React.ReactNode;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  wrapTitle?: boolean;
}

export default function ServiceModalShell({ title, icon, onClose, children, wrapTitle = false }: Props) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[min(760px,calc(100dvh-2rem))]">
        <div className="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 sm:px-4">
          <h2 id="service-modal-title" className="flex min-w-0 items-center gap-2 text-base font-bold text-[var(--text-primary)] sm:text-lg">
            {icon}
            <span className={wrapTitle ? 'min-w-0 whitespace-normal break-words leading-relaxed' : 'truncate'}>{title}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--text-muted)] transition-all hover:bg-red-500/10 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            aria-label="إغلاق بدون حفظ"
            title="إغلاق بدون حفظ"
          >
            <X className="h-7 w-7" aria-hidden="true" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
