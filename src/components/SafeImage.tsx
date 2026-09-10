import { useCallback, useRef, useState, type ImgHTMLAttributes, type ReactEventHandler } from 'react';

// ==============================
// SafeImage / useImageFallback
// ------------------------------
// صورة بديلة آمنة مضمّنة (SVG data-URI): لا تحتاج أي طلب شبكة ولا يمكن أن تفشل،
// لذلك لا يمكن أن يحدث loop عند فشل الصورة الأصلية. ومع ذلك يوجد حارس
// (fallbackAppliedRef) يمنع إعادة التعيين أكثر من مرة واحدة لكل مصدر أصلي.
// ==============================
export const FALLBACK_IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#e2e8f0'/>
      <stop offset='1' stop-color='#cbd5e1'/>
    </linearGradient>
  </defs>
  <rect width='800' height='600' fill='url(#g)'/>
  <g stroke='#94a3b8' stroke-width='8' fill='none' stroke-linecap='round' stroke-linejoin='round'>
    <rect x='300' y='200' width='200' height='150' rx='14'/>
    <circle cx='348' cy='248' r='16'/>
    <path d='M316 338l52-50 36 34 44-52 44 68'/>
  </g>
  <text x='400' y='430' font-family='Tahoma, Arial, sans-serif' font-size='30' font-weight='bold' fill='#64748b' text-anchor='middle'>وصال | WISAL</text>
</svg>`
  );

/**
 * هوك يعيد `[src, onError]` آمنين: عند فشل تحميل `originalSrc` يُستبدل المصدر
 * بصورة بديلة آمنة مرة واحدة فقط. وعند تغيّر `originalSrc` (مثل تغيّر شريحة
 * السلايدر) تُعاد التعيين تلقائياً لتُحاول الصورة الجديدة.
 */
export function useImageFallback(originalSrc: string, fallbackSrc: string = FALLBACK_IMAGE) {
  const [src, setSrc] = useState(originalSrc);
  const fallbackAppliedRef = useRef(false);
  const originalSrcRef = useRef(originalSrc);

  // إعادة التعيين فور تغيّر الصورة الأصلية: المصدر الجديد يُجرب من جديد
  // (لا يبقى fallback من صورة قديمة معروضاً على صورة جديدة).
  if (originalSrcRef.current !== originalSrc) {
    originalSrcRef.current = originalSrc;
    fallbackAppliedRef.current = false;
    setSrc(originalSrc);
  }

  const onError = useCallback(() => {
    // حارس ضد الـ loop: إذا وصلنا للصورة البديلة وفشلت أيضاً نتجاهل الخطأ
    // نهائياً ولا نعيد التعيين ثانيةً ولا نجرب أي مصدر آخر.
    if (fallbackAppliedRef.current) return;
    fallbackAppliedRef.current = true;
    setSrc(fallbackSrc);
  }, [fallbackSrc]);

  return { src, onError };
}

interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc?: string;
}

/**
 * `<img>` آمن: يطابق خصائص `<img>` العادية تماماً مع إضافة fallback تلقائي
 * عند فشل التحميل (بدون أي loop). يُستخدم لكل صور الشبكة (Supabase).
 *
 * تحميل تدريجي: `loading="lazy"` افتراضياً — المتصفح لا يجلب الصورة إلا عند
 * اقترابها من منطقة العرض، فيُمنع جلب كل صور الخدمات دفعة واحدة عند فتح
 * الصفحة. (يمكن تمرير loading="eager" صراحةً للصور فوق الطية فقط).
 */
export function SafeImage({ src, fallbackSrc = FALLBACK_IMAGE, onError, decoding = 'async', loading = 'lazy', ...rest }: SafeImageProps) {
  const { src: safeSrc, onError: safeOnError } = useImageFallback(src, fallbackSrc);

  const handleError: ReactEventHandler<HTMLImageElement> = useCallback(
    (event) => {
      safeOnError();
      onError?.(event);
    },
    [safeOnError, onError]
  );

  return <img {...rest} src={safeSrc} onError={handleError} decoding={decoding} loading={loading} />;
}

export default SafeImage;