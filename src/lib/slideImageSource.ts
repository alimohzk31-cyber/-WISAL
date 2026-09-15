import { supabase } from './supabase';
import { SERVICE_MEDIA_BUCKET } from './serviceMediaStorage';

// مسار مطلق أو رابط كامل أو مصدر بيانات محلي (لا يحتاج أي تحويل).
const ABSOLUTE_SOURCE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i;

/**
 * توحيد مصدر صورة الشريحة إلى ما يفهمه المتصفح فعلاً.
 *
 * - `data:image/...` (base64) → يُعاد كما هو. هذا هو الشكل الحقيقي لصور الخدمات
 *   المخزنة في services.image_url.
 * - `https://...` أو `//...` (صور الوظائف في Storage) → يُعاد كما هو.
 * - مسار داخل Supabase Storage بدون بروتوكول (`jobs/1712_x.webp`) → يُحوَّل إلى
 *   Public URL عبر نفس الحاوية المستخدمة في الرفع (service-media).
 * - أي قيمة فارغة/غير نصية → '' بدون اختراع رابط.
 */
export function resolveSlideImageSrc(value: string | null | undefined): string {
  const src = typeof value === 'string' ? value.trim() : '';
  if (!src) return '';
  if (ABSOLUTE_SOURCE.test(src)) return src;
  try {
    const { data } = supabase.storage.from(SERVICE_MEDIA_BUCKET).getPublicUrl(src);
    if (data?.publicUrl) return data.publicUrl;
  } catch (error) {
    console.warn('[SlideImage] تعذر تحويل مسار الصورة إلى رابط عام:', src, error);
  }
  return src;
}
