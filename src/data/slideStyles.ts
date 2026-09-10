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