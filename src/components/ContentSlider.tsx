import { useCallback, useEffect, useRef, useState, type ReactEventHandler } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  BROWSE_SLIDER_BACKDROP_CLASS, BROWSE_SLIDER_CONTAIN_CLASS, BROWSE_SLIDER_FRAME_CLASS,
  BROWSE_SLIDER_IMAGE_CLASS, getSliderSwipeAction,
} from '../data/slideStyles';
import { usePageVisible } from '../hooks/usePageVisible';
import { useSlideImages } from '../hooks/useSlideImages';
import { useImageFallback } from './SafeImage';
import type { ContentSlide } from '../lib/contentSlides';

interface ContentSliderProps {
  slides: readonly ContentSlide[];
  label: string;
  testId: string;
  loading?: boolean;
  autoplay?: boolean;
  durationSeconds?: number;
  loop?: boolean;
  touchDrag?: boolean;
  /**
   * 'cover'   = تعبئة الإطار كاملاً (السلوك الحالي لسلايدر التصفح).
   * 'contain' = الصورة كاملة بدون قص، فوق طبقة خلفية مموّهة تملأ الفراغات.
   */
  imageFit?: 'cover' | 'contain';
}

// Shared presentation and gestures only. Each page supplies its own approved content.
export default function ContentSlider({
  slides, label, testId, loading = false, autoplay = true, durationSeconds = 5,
  loop = true, touchDrag = true, imageFit = 'cover',
}: ContentSliderProps) {
  const visible = usePageVisible();
  const [index, setIndex] = useState(0);
  const pointerStart = useRef<{ id: number; x: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const count = slides.length;
  const currentIndex = index < count ? index : 0;
  const slide = slides[currentIndex];
  // مصدر الصورة الحقيقي: من البيانات إن وُجد، وإلا يُجلب بالمعرّف من طبقة الكاش
  // (قائمة الخدمات العامة لا تحمل image_url لأن صور الخدمات base64 ثقيل).
  const { imageFor, isLoading } = useSlideImages(slides, currentIndex);
  const rawSrc = slide ? imageFor(slide) : '';
  const { src, onError } = useImageFallback(rawSrc);
  const pendingImage = slide ? isLoading(slide) : false;

  useEffect(() => { if (index >= count) setIndex(0); }, [index, count]);
  const next = useCallback(() => setIndex(current => count === 0 ? 0 : loop ? (current + 1) % count : Math.min(current + 1, count - 1)), [count, loop]);
  const previous = useCallback(() => setIndex(current => count === 0 ? 0 : loop ? (current - 1 + count) % count : Math.max(current - 1, 0)), [count, loop]);

  useEffect(() => {
    if (!visible || !autoplay || count <= 1) return;
    const timer = window.setTimeout(next, Math.max(3, durationSeconds) * 1000);
    return () => window.clearTimeout(timer);
  }, [visible, autoplay, count, currentIndex, slide?.id, durationSeconds, next]);

  // تشخيص مؤقت: يربط فشل الصورة بمعرّف الشريحة والمصدر النهائي وسبب الفشل.
  // يعمل في التطوير فقط (لا يزحم إنتاج المستخدمين) ويسجّل السبب المقروء من المتصفح.
  const handleImageError: ReactEventHandler<HTMLImageElement> = useCallback((event) => {
    const image = event.currentTarget;
    onError();
    if ((import.meta as any).env?.DEV) {
      console.error('[ContentSlider] فشل تحميل صورة الشريحة', {
        slider: testId,
        slideId: slide?.id,
        serviceId: slide?.serviceId ?? '—',
        resolvedSrc: rawSrc
          ? `${rawSrc.slice(0, 140)}${rawSrc.length > 140 ? `… (${rawSrc.length} حرف)` : ''}`
          : 'فارغ (لا يوجد مصدر صورة)',
        naturalSize: `${image.naturalWidth}x${image.naturalHeight}`,
        failedUrl: image.currentSrc,
        reason: rawSrc ? 'طلب الصورة فشل (404/CORS/بيانات تالفة)' : 'الشريحة وصلت بلا مصدر صورة',
      });
    }
  }, [onError, rawSrc, slide?.id, slide?.serviceId, testId]);

  // نطاق مؤشرات النقاط: كل عنصر معتمد يظل قابلاً للوصول.
  const firstDot = Math.max(0, Math.min(currentIndex - 3, count - 7));
  const dots = Array.from({ length: Math.min(7, count) }, (_, offset) => firstDot + offset);

  return <section dir="rtl" data-testid={testId} aria-label={label} aria-roledescription="سلايدر"
    className={`${BROWSE_SLIDER_FRAME_CLASS} group touch-pan-y bg-[var(--bg-secondary)] ${touchDrag && count > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
    onPointerDown={event => {
      if (!touchDrag || count <= 1 || (event.target as Element).closest('button') || (event.pointerType === 'mouse' && event.button !== 0)) return;
      pointerStart.current = { id: event.pointerId, x: event.clientX };
    }}
    onPointerMove={event => {
      const start = pointerStart.current;
      if (start?.id === event.pointerId && getSliderSwipeAction(start.x, event.clientX)) event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerUp={event => {
      const start = pointerStart.current;
      pointerStart.current = null;
      if (!start || start.id !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      const action = getSliderSwipeAction(start.x, event.clientX);
      if (!action) return;
      suppressClickUntil.current = Date.now() + 250;
      if (action === 'previous') previous(); else next();
    }}
    onPointerCancel={() => { pointerStart.current = null; }}
    onClickCapture={event => {
      if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
    }}>
    {slide ? <>
      <AnimatePresence mode="wait">
        <motion.div key={slide.id} data-slide-id={slide.id}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
          className="absolute inset-0">
          {imageFit === 'contain' ? <>
            {/* طبقة خلفية: نفس الصورة بـ cover + blur خفيف لملء الفراغات فقط. */}
            <img src={src} alt="" aria-hidden="true" draggable={false} decoding="async"
              data-slide-layer="backdrop" className={BROWSE_SLIDER_BACKDROP_CLASS} />
            {/* الصورة الأصلية كاملة بدون قص — أكبر مساحة ممكنة داخل السلايدر. */}
            <img src={src} alt={slide.title} onError={handleImageError} draggable={false} decoding="async"
              loading="eager" fetchPriority={currentIndex === 0 ? 'high' : 'auto'}
              data-slide-layer="foreground" className={BROWSE_SLIDER_CONTAIN_CLASS} />
          </> : <img src={src} alt={slide.title} onError={handleImageError} draggable={false} decoding="async"
            loading="eager" fetchPriority={currentIndex === 0 ? 'high' : 'auto'}
            data-slide-layer="foreground" className={BROWSE_SLIDER_IMAGE_CLASS} />}
        </motion.div>
      </AnimatePresence>
      {pendingImage ? <div data-slide-loading="true" className="pointer-events-none absolute inset-0 z-[1] animate-pulse bg-[var(--bg-secondary)]/60" aria-hidden="true" /> : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-transparent" aria-hidden="true" />
      <Link to={slide.href} draggable={false} className="absolute inset-0 z-10 rounded-3xl focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[var(--accent-primary)]" aria-label={`فتح ${slide.title}`} />
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-end overflow-hidden px-4 pb-8 text-right text-white sm:px-6 md:pb-10">
        <motion.h1 key={`title-${slide.id}`} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-1 line-clamp-1 w-full text-lg font-semibold leading-snug [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] md:mb-1.5 md:text-[24px]">{slide.title}</motion.h1>
      </div>
      {count > 1 && <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center gap-1.5 px-4 md:bottom-4">
        {dots.map(dot => <button key={slides[dot].id} type="button" onClick={() => setIndex(dot)} aria-label={`الشريحة ${dot + 1} من ${count}`} aria-current={dot === currentIndex ? 'true' : undefined}
          className={`h-1.5 rounded-full transition-all duration-500 ${dot === currentIndex ? 'w-6 bg-[var(--accent-primary)]' : 'w-1.5 bg-white/60 hover:bg-white/90'}`} />)}
      </div>}
    </> : <div className={`absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-bold text-[var(--text-secondary)] ${loading ? 'animate-pulse' : ''}`} role="status">
      {loading ? 'جارٍ تحميل المحتوى…' : 'لا يوجد محتوى موافق عليه حالياً'}
    </div>}
  </section>;
}
