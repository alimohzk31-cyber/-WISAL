// ---------------------------------------------------------------------------
// أنماط نص الشريحة (المكان والمحاذاة) — ملف خفيف منفصل.
// سبب الفصل: كانت هذه الثابتات مُصدَّرة من components/SliderManager (مكوّن
// لوحة الإدارة الأثقل) وتستوردها الصفحة الرئيسية Home، فكان chunk الإدارة
// الكامل (عشرات أيقونات lucide + أدوات رفع صور) يُسحب إلى تحميل الرئيسية.
// الآن كل من Home و SliderManager يستوردانها من هنا بدون أي اعتماد ثقيل.
// ---------------------------------------------------------------------------

/** مكان النص على الصورة (أعلى/وسط/أسفل) — نفس القيم المستخدمة في SliderManager. */
export const SLIDE_POSITION_CLASSES: Record<string, string> = {
  top: 'justify-start pt-5 md:pt-7',
  middle: 'justify-center',
  bottom: 'justify-end pb-8 md:pb-12'
};

/** محاذاة النص (يمين/وسط/يسار). */
export const SLIDE_TEXT_ALIGN: Record<string, 'right' | 'center' | 'left'> = {
  right: 'right',
  center: 'center',
  left: 'left'
};

/**
 * الإطار البصري المشترك لسلايدر التصفح وسلايدر الوظائف.
 * إبقاؤه هنا يمنع اختلاف العرض/الارتفاع/الزوايا بين الصفحتين مستقبلًا.
 */
export const BROWSE_SLIDER_FRAME_CLASS =
  'relative mx-auto h-[165px] w-full min-w-0 max-w-full select-none overflow-hidden rounded-3xl shadow-2xl sm:h-[170px] sm:max-w-5xl md:h-[230px]';

export const BROWSE_SLIDER_IMAGE_CLASS =
  'absolute inset-0 h-full w-full object-cover object-center';

/**
 * وضع "الصورة الكاملة" (بدون قص) — طبقتان من نفس الصورة:
 *   1) BROWSE_SLIDER_BACKDROP_CLASS: تملأ الإطار بـ cover مع blur خفيف وتعتيم
 *      بسيط، فقط لملء الفراغات حول الصورة الأصلية بدون فراغ قبيح.
 *   2) BROWSE_SLIDER_CONTAIN_CLASS: الصورة الأصلية كاملة (contain) تستغل أكبر
 *      مساحة ممكنة داخل السلايدر مع الحفاظ على نسبة الأبعاد — لا قص من الأعلى
 *      أو الأسفل ولا تشويه.
 * يُستخدم في سلايدر الوظائف لأن صور الوظائف عمودية/مربعة/أفقية بأحجام مختلفة.
 */
export const BROWSE_SLIDER_BACKDROP_CLASS =
  'absolute inset-0 h-full w-full scale-110 object-cover object-center blur-md brightness-[0.7]';

export const BROWSE_SLIDER_CONTAIN_CLASS =
  'absolute inset-0 h-full w-full object-contain object-center';

export type SliderSwipeAction = 'next' | 'previous' | null;

/** RTL swipe direction shared by touch and mouse pointer events. */
export function getSliderSwipeAction(startX: number, endX: number, threshold = 40): SliderSwipeAction {
  const distance = endX - startX;
  if (Math.abs(distance) < threshold) return null;
  return distance > 0 ? 'previous' : 'next';
}
