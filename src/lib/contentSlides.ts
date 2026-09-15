import type { Job } from '../features/jobs/types';
import type { Section, Service } from '../types/models';

export interface ContentSlide {
  id: string;
  title: string;
  category: string;
  /** مصدر الصورة كما وصل من البيانات (قد يكون فارغاً إذا لم يجلبه الاستعلام). */
  imageUrl: string;
  href: string;
  /**
   * المعرّف الرقمي للخدمة في public.services.
   * يُستخدم فقط لجلب صورة الغلاف عند الحاجة (قائمة الخدمات العامة لا تحمل
   * image_url لأنها base64 ثقيل — راجع SERVICE_LIST_COLUMNS في hooks/useServices).
   */
  serviceId?: string | number;
  /** المعرّف الرقمي للوظيفة في public.jobs (نفس الغرض عند الحاجة مستقبلاً). */
  jobId?: string | number;
}

/** Temporary local visual QA switch. Set VITE_SLIDER_DEMO_MODE=false for live approved content. */
export const SLIDER_DEMO_MODE = String((import.meta as any).env?.VITE_SLIDER_DEMO_MODE ?? 'true').toLowerCase() !== 'false';
const SERVICE_DEMO_LABELS = ['كهربائي منازل', 'سباك', 'صيدلية', 'طبيب', 'مطعم', 'ميكانيكي سيارات', 'بناء وإنشاءات', 'ألواح طاقة شمسية', 'ملابس', 'هواتف وصيانة'];
const JOB_DEMO_LABELS = ['موظف مبيعات', 'محاسب', 'سائق', 'عامل مطعم', 'كهربائي', 'موظف مكتب', 'مصمم', 'مبرمج', 'مندوب توصيل', 'تدريب عن بُعد'];

function demoSlides(group: 'services' | 'jobs', labels: readonly string[]): ContentSlide[] {
  return labels.map((title, index) => ({
    id: `demo-${group}-${index + 1}`,
    title,
    category: group === 'services' ? 'خدمات وصال' : 'فرص وصال',
    imageUrl: `/slider-demo/${group}/${group === 'services' ? 'service' : 'job'}-${String(index + 1).padStart(2, '0')}.png`,
    href: group === 'services' ? '/?view=services' : '/jobs',
  }));
}

export const DEMO_SERVICE_SLIDES = demoSlides('services', SERVICE_DEMO_LABELS);
export const DEMO_JOB_SLIDES = demoSlides('jobs', JOB_DEMO_LABELS);

// أسماء حقول الصورة المعروفة في هذا المشروع — البيانات الحقيقية المثبتة:
//   * services.image_url    = data URI (base64) للصور المرفوعة من AddServiceModal
//   * jobs.image_url        = رابط Storage عام (service-media)
//   * job_slides.image_url  = رابط Storage عام
// نقرأ كل الأسماء المحتملة بدل افتراض حقل واحد فقط، فلا يختفي السلايدر إذا
// جاء المصدر باسم آخر (imageUrl / image / image_path / cover / thumbnail...).
const SLIDE_IMAGE_FIELDS = [
  'image_url', 'imageUrl', 'image', 'image_path', 'imagePath',
  'cover', 'cover_url', 'thumbnail', 'thumbnail_url', 'photo',
] as const;

function firstUsableImage(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstUsableImage(entry);
      if (found) return found;
    }
  }
  return '';
}

/**
 * الدالة الواحدة الآمنة لحل مصدر صورة الشريحة.
 * تقبل كائناً فيه أي من الحقول المعروفة (أو نصاً/مصفوفة نصوص مباشرة)،
 * وتعيد أول قيمة نصية غير فارغة — أو '' إذا لا يوجد مصدر حقيقي.
 * لا تخترع رابطاً أبداً، ودائماً تراعي القيم الفارغة/المسافات (fail-closed).
 */
export function resolveSlideImage(source: unknown): string {
  if (typeof source === 'string' || Array.isArray(source)) return firstUsableImage(source);
  if (!source || typeof source !== 'object') return '';
  const record = source as Record<string, unknown>;
  for (const field of SLIDE_IMAGE_FIELDS) {
    const found = firstUsableImage(record[field]);
    if (found) return found;
  }
  return firstUsableImage(record.images) || firstUsableImage(record.image_urls);
}

function primaryImage(source: unknown, fallback?: readonly string[]): string {
  return resolveSlideImage(source) || firstUsableImage(fallback);
}

export function buildJobContentSlides(jobs: readonly Job[]): ContentSlide[] {
  return jobs.filter(job => job.status === 'approved')
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
    .map(job => ({
      id: `job-${job.id}`,
      title: job.title,
      category: job.categoryName?.trim() || job.specialty?.trim() || 'الوظائف',
      imageUrl: primaryImage(job, job.images),
      href: `/jobs/${job.id}`,
      jobId: job.id,
    }));
}

export function buildServiceContentSlides(services: readonly Service[], categories: readonly Section[]): ContentSlide[] {
  const byId = new Map(categories.filter(category => category.dbId != null).map(category => [String(category.dbId), category.name]));
  const bySlug = new Map(categories.map(category => [category.slug, category.name]));
  return services.filter(service => service.status === 'approved')
    .sort((a, b) => (b.reviewedAt ?? b.createdAt) - (a.reviewedAt ?? a.createdAt))
    .map(service => ({
      id: `service-${service.id ?? service.slug}`,
      title: service.name,
      category: byId.get(String(service.categoryId)) || bySlug.get(service.categorySlug) || service.subCategory?.trim() || service.profession?.trim() || 'الخدمات',
      imageUrl: primaryImage(service, service.images),
      href: service.id != null ? `/service/${encodeURIComponent(String(service.id))}` : `/category/${encodeURIComponent(service.categorySlug)}`,
      serviceId: service.id,
    }));
}
