import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  message?: string;
  /** عند تمريرها يظهر زر «إعادة المحاولة» */
  onRetry?: () => void;
  className?: string;
}

/** حالة خطأ موحدة — رسالة واضحة + زر إعادة محاولة اختياري (بدون console صامت). */
export default function ErrorState({
  message = 'تعذّر تحميل البيانات من الخادم. تحقق من اتصالك بالإنترنت.',
  onRetry,
  className = 'py-4',
}: Props) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-red-300 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500 ${className}`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-1.5 text-white transition-colors hover:bg-red-600"
        >
          <RefreshCw className="h-4 w-4" /> إعادة المحاولة
        </button>
      )}
    </div>
  );
}
