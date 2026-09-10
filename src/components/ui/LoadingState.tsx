import { Loader2 } from 'lucide-react';

interface Props {
  /** النص المعروض تحت المؤشر (فارغ = بدون نص) */
  label?: string;
  className?: string;
}

/** حالة تحميل موحدة — مؤشر دوران + نص اختياري، بدل التكرار في كل صفحة. */
export default function LoadingState({ label = 'جارٍ التحميل…', className = 'py-20' }: Props) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-primary)]" aria-hidden="true" />
      {label && <p className="font-bold text-[var(--text-muted)]">{label}</p>}
    </div>
  );
}
