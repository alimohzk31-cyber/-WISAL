interface Props {
  /** النص المعروض تحت المؤشر (فارغ = بدون نص) */
  label?: string;
  className?: string;
}

/** Skeleton خفيف يمنع الشاشة البيضاء ومؤشر الدوران الطويل في أول تشغيل. */
export default function LoadingState({ label = 'جارٍ التحميل…', className = 'py-20' }: Props) {
  return (
    <div role="status" aria-live="polite" className={`mx-auto w-full max-w-2xl space-y-4 ${className}`}>
      <div className="h-40 animate-pulse rounded-3xl bg-[var(--bg-secondary)]" aria-hidden="true" />
      <div className="grid grid-cols-2 gap-3" aria-hidden="true">
        <div className="h-24 animate-pulse rounded-2xl bg-[var(--bg-secondary)]" />
        <div className="h-24 animate-pulse rounded-2xl bg-[var(--bg-secondary)]" />
      </div>
      {label && <p className="text-center text-sm font-bold text-[var(--text-muted)]">{label}</p>}
    </div>
  );
}
