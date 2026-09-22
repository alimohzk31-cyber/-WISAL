import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ContentSlide } from '../lib/contentSlides';
import { resolveSlideImageSrc } from '../lib/slideImageSource';
import { fetchServiceImage } from '../lib/serviceMedia';

export interface SlideImageResolver {
  /** المصدر النهائي للصورة ('' = لا يوجد مصدر بعد أو إطلاقاً). */
  imageFor: (slide: ContentSlide) => string;
  /** الصورة تُجلب الآن لهذه الشريحة (لعرض مؤشر تحميل بدل الفراغ الرمادي). */
  isLoading: (slide: ContentSlide) => boolean;
}

/**
 * ============================================================================
 * useSlideImages — جلب صور شرائح السلايدر بدون أي طلب ضخم
 * ----------------------------------------------------------------------------
 * السبب المثبت بالبيانات الحقيقية: قائمة الخدمات العامة (SERVICE_LIST_COLUMNS)
 * لا تُحمّل image_url لأن صور الخدمات مخزّنة base64 داخل الصف (20KB–400KB لكل
 * صورة)، فكانت شرائح "الخدمات المعتمدة" تصل بمصدر صورة فارغ وتظهر رمادية.
 *
 * الحل هنا: نطلب صورة الشريحة المعروضة (والشرائح التالية لها فقط) من نفس طبقة
 * الكاش الموجودة أصلاً في التطبيق (lib/serviceMedia):
 *   1. getCachedServiceImage → قراءة فورية من IndexedDB إن كانت محفوظة.
 *   2. fetchServiceImage      → طلب صف واحد فقط (id,image_url) بلا تكرار.
 * وبهذا لا نُثقل أول تحميل ولا نطلب صوراً لا يراها المستخدم.
 * ============================================================================
 */
export function useSlideImages(slides: readonly ContentSlide[], activeIndex: number, lookAhead = 3): SlideImageResolver {
  const [resolved, setResolved] = useState<Record<string, string>>({});
  // settled = انتهت محاولة الجلب لهذه الشريحة (بصورة أو بلا صورة).
  // الفرق مهم: قبل انتهاء المحاولة نعرض مؤشر تحميل، وبعدها إما الصورة أو البديل.
  const [settled, setSettled] = useState<Record<string, boolean>>({});
  // طلب واحد لكل شريحة يُعاد استخدامه: في وضع التطوير (StrictMode) يُشغّل React
  // الـ effect مرتين؛ لو منعنا المحاولة الثانية بقيت الشريحة بلا صورة للأبد.
  const requests = useRef(new Map<string, Promise<string>>());

  const imageFor = useCallback(
    (slide: ContentSlide) => resolveSlideImageSrc(resolved[slide.id] || slide.imageUrl),
    [resolved]
  );
  // اشتقاق حالة التحميل من الحالة نفسها (بلا مؤقتات) يمنع أي لحظة يظهر فيها
  // البديل الرمادي ثم تختفي: لا بديل قبل انتهاء المحاولة.
  const isLoading = useCallback(
    (slide: ContentSlide) => slide.serviceId != null && !resolved[slide.id] && !settled[slide.id]
      && !resolveSlideImageSrc(slide.imageUrl),
    [resolved, settled]
  );

  // الشرائح المطلوبة: الحالية + التي بعدها (تحميل مسبق بسيط، وبلا لفّ لا نهائي).
  const targets = useMemo(() => {
    if (!slides.length) return [];
    const wanted: ContentSlide[] = [];
    const seen = new Set<string>();
    for (let offset = 0; offset <= Math.max(0, lookAhead); offset += 1) {
      const slide = slides[(activeIndex + offset) % slides.length];
      if (slide && !seen.has(slide.id)) { seen.add(slide.id); wanted.push(slide); }
    }
    return wanted;
  }, [slides, activeIndex, lookAhead]);

  useEffect(() => {
    let active = true;
    const load = async (slide: ContentSlide) => {
      const id = slide.serviceId;
      if (id == null) return;
      let request = requests.current.get(slide.id);
      if (!request) {
        // fetchServiceImage returns cached media immediately and only refreshes
        // stale entries in the background.
        request = fetchServiceImage(id);
        requests.current.set(slide.id, request);
      }
      try {
        const url = await request;
        if (active && url) {
          setResolved(previous => (previous[slide.id] === url ? previous : { ...previous, [slide.id]: url }));
        }
      } catch (error) {
        // لا نُسقط السلايدر بسبب صورة واحدة: تُترك القيمة فارغة ويُسجَّل السبب.
        console.warn('[useSlideImages] تعذر جلب صورة الشريحة', { slideId: slide.id, serviceId: id, error });
      } finally {
        if (active) {
          setSettled(previous => (previous[slide.id] ? previous : { ...previous, [slide.id]: true }));
        }
      }
    };
    for (const slide of targets) void load(slide);
    return () => { active = false; };
  }, [targets]);

  return { imageFor, isLoading };
}
