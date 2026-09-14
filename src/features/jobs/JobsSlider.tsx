import { useCallback, useEffect, useRef, useState } from 'react';
import { usePageVisible } from '../../hooks/usePageVisible';
import { AnimatePresence, motion } from 'motion/react';
import type { JobSlide, JobSliderSettings } from './admin/jobAdminApi';
import { BROWSE_SLIDER_FRAME_CLASS, getSliderSwipeAction } from '../../data/slideStyles';
import type { Job } from './types';
import JobSlideView from './JobSlideView';

// شرائح احتياطية جميلة تظهر فقط عندما لا يوجد أي سلايد مُدار في قاعدة البيانات
const FALLBACK_SLIDES = [
  { title: 'فرصتك الجديدة تبدأ من وصال', subtitle: 'اكتشف الوظائف المناسبة في محافظتك ومنطقتك.', color: 'from-violet-700 to-indigo-900' },
  { title: 'وظائف أقرب إليك', subtitle: 'ابحث حسب الاختصاص ونوع الدوام بسهولة.', color: 'from-rose-600 to-orange-700' },
  { title: 'انشر فرصة عمل', subtitle: 'أضف الوظيفة لتراجعها الإدارة قبل نشرها.', color: 'from-emerald-600 to-teal-800' },
];

export default function JobsSlider({ managedSlides = [], jobs = [] }: { managedSlides?: JobSlide[]; settings?: JobSliderSettings; jobs?: Job[] }) {
  const pageVisible = usePageVisible();
  const [index, setIndex] = useState(0);
  const pointerStart = useRef<{ id: number; x: number } | null>(null);
  const suppressClick = useRef(false);
  const preloadedRef = useRef<Set<string>>(new Set());

  const isFallback = managedSlides.length === 0;
  const count = isFallback ? FALLBACK_SLIDES.length : managedSlides.length;

  // إصلاح الفهرس إذا تقلصت القائمة (حذف آخر شريحة مثلاً)
  useEffect(() => { if (index >= count) setIndex(0); }, [index, count]);

  const next = useCallback(() => setIndex(prev => (prev + 1) % count), [count]);
  const prev = useCallback(() => setIndex(prev => (prev - 1 + count) % count), [count]);

  // تحميل مسبق لصورة الشريحة التالية فقط (اللازمة) — الصور غير الحالية لا تُجلب إلا عند ظهورها
  const nextSlideUrl = !isFallback && count > 1 ? managedSlides[(index + 1) % count]?.imageUrl || '' : '';
  useEffect(() => {
    if (!pageVisible || !nextSlideUrl || preloadedRef.current.has(nextSlideUrl)) return;
    preloadedRef.current.add(nextSlideUrl);
    const img = new Image();
    img.src = nextSlideUrl;
  }, [nextSlideUrl, pageVisible]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (count <= 1 || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointerStart.current = { id: event.pointerId, x: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const finishPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const action = getSliderSwipeAction(start.x, event.clientX);
    if (!action) return;
    suppressClick.current = true;
    if (action === 'previous') prev(); else next();
    window.setTimeout(() => { suppressClick.current = false; }, 250);
  };
  const cancelPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStart.current?.id === event.pointerId) pointerStart.current = null;
  };

  const showDots = isFallback ? true : managedSlides[index]?.showDots !== false;

  return (
    <div
      dir="rtl"
      data-testid="jobs-slider"
      onPointerDown={onPointerDown}
      onPointerUp={finishPointer}
      onPointerCancel={cancelPointer}
      onClickCapture={event => {
        if (!suppressClick.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      className={`${BROWSE_SLIDER_FRAME_CLASS} touch-pan-y cursor-grab bg-[var(--bg-secondary)] active:cursor-grabbing`}
    >
      <AnimatePresence mode="wait">
        {isFallback ? (
          <motion.section
            key={`fb-${index}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className={`absolute inset-0 flex items-center bg-gradient-to-br ${FALLBACK_SLIDES[index].color} p-7 text-white sm:p-10`}
          >
            <div className="max-w-lg">
              <h1 className="text-2xl font-black sm:text-4xl">{FALLBACK_SLIDES[index].title}</h1>
              <p className="mt-3 font-bold text-white/85">{FALLBACK_SLIDES[index].subtitle}</p>
            </div>
          </motion.section>
        ) : (
          <motion.div
            key={`slide-${index}-${managedSlides[index]?.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            <JobSlideView
              slide={managedSlides[index]}
              linkedJob={managedSlides[index]?.linkType === 'job'
                ? jobs.find(job => String(job.id) === String(managedSlides[index]?.linkValue))
                : undefined}
              loading={index === 0 ? 'eager' : 'lazy'}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {count > 1 && (
        showDots && (
          <div className="pointer-events-none absolute bottom-3 left-0 right-0 z-30 flex justify-center gap-1.5 px-4" aria-label={`الشريحة ${index + 1} من ${count}`}>
            {Array.from({ length: count }).map((_, idx) => (
              <span
                key={`dot-${idx}`}
                aria-hidden="true"
                className={`h-1.5 rounded-full transition-all duration-500 ${idx === index ? 'w-6 bg-[var(--accent-primary)]' : 'w-1.5 bg-white/60'}`}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
