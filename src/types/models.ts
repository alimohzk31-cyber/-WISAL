/**
 * types/models — المصدر المركزي الوحيد لأنواع بيانات المشروع
 * -----------------------------------------------------------------------------
 * القاعدة: أي نوع يمثل بيانات أساسية (خدمة، قسم، إشعار، اقتراح...) يُعرَّف هنا
 * فقط. لا تعيد تعريف الشكل نفسه في صفحات أو hooks أخرى — استورده من هذا الملف
 * (وإن كان مُصدَّراً من hooks/useServices فهو إعادة تصدير من هنا).
 * -----------------------------------------------------------------------------
 */

import type { AdminNotification } from '../lib/notifications';
import type { Comment } from '../hooks/useComments';

// ---------------------------------------------------------------------------
// Service — الخدمة (صف من public.services بعد التحويل عبر mapRowToService)
// ---------------------------------------------------------------------------

/** حالات الخدمة الموحدة — لا تستخدم نصوصاً مبعثرة 'pending'/'approved'/'rejected' في الملفات. */
export type ServiceStatus = 'pending' | 'approved' | 'rejected' | 'archived' | 'deleted';

export interface Service {
  id?: string | number;
  slug: string;
  name: string;
  profession?: string;
  experience?: string;
  phone?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  image: string;
  video?: string;
  views?: number;
  categorySlug: string;
  // المفتاح الحقيقي لصف القسم في public.categories (services.category_id FK).
  // يُحفظ بجانب categorySlug حتى لا نعتمد على الاسم/slug وحدهما أبداً.
  categoryId?: string | number | null;
  subCategory?: string;
  createdAt: number;
  status?: ServiceStatus;
  // آخر تعديل من services.updated_at (موجود في DB — بدون أعمدة جديدة)
  updatedAt?: number;
  // وقت قرار الإدارة من services.reviewed_at. للمعتمدة هي وقت الموافقة
  // وهي مفتاح الترتيب الرسمي في صفحة التصفح.
  reviewedAt?: number;
  rejectionReason?: string;
  isOffline?: boolean;
  ownerId?: string;
  userId?: number | null;
}

// ---------------------------------------------------------------------------
// SectionFieldConfig — إعدادات نموذج "إضافة خدمة" الخاصة بكل قسم
// (تُضمَّن داخل بيانات القسم نفسه في data/categories.ts عبر fields،
//  أو في خريطة data/categoryFields.ts للأقسام القديمة).
// ---------------------------------------------------------------------------

export interface SectionFieldConfig {
  /** تسمية حقل الاسم (تختلف حسب القسم: صيدلية / عيادة / ورشة...) */
  nameLabel: string;
  /** مثال يظهر كـ placeholder لحقل الاسم */
  namePlaceholder: string;
  /** المهنة الافتراضية التي تُعبأ تلقائياً عند فتح النموذج من هذا القسم */
  profession: string;
  professionLabel?: string;
  /** تخصيص العرض فقط؛ تُحفظ النبذة والعنوان والهاتف في الأعمدة الحالية. */
  experienceLabel?: string;
  experiencePlaceholder?: string;
  locationLabel?: string;
  locationPlaceholder?: string;
  phoneLabel?: string;
  allowCustomSpecialty?: boolean;
  /** قائمة التخصصات المقترحة لهذا القسم (تظهر كقائمة اختيار) */
  specialties: string[];
  /** إعداد معاينة التسجيل؛ لا يُفعّل الحفظ قبل تجهيز التخزين والموافقة عليه. */
  registration?: SectionRegistrationConfig;
}

export interface SectionRegistrationConfig {
  fields: {
    key: string;
    label: string;
    placeholder: string;
    type: 'text' | 'number' | 'textarea';
    required: boolean;
    min?: number;
    attachment?: boolean;
  }[];
  phoneRequired: boolean;
  images: { min: number; max: number };
}

export interface ServiceRegistrationAttachment {
  name: string;
  type: string;
  dataUrl: string;
}

export interface ServiceRegistrationDraft {
  name: string;
  phone: string;
  categorySlug: string;
  categoryId?: string | number;
  details: Record<string, string>;
  images: string[];
  credential?: ServiceRegistrationAttachment;
  video?: string;
  status: 'pending';
}

// ---------------------------------------------------------------------------
// Section — الشكل الموحد لأي قسم (ثابت في data/categories.ts أو من قاعدة البيانات)
// ---------------------------------------------------------------------------

export interface Section {
  slug: string;
  name: string;
  /** المجموعة/التصنيف الأب (مثل 'health' في data/categories) إن وجد */
  groupId?: string;
  /** مكوّن أيقونة React (الأقسام الثابتة) أو اسم الأيقونة نصياً (قاعدة البيانات) */
  icon?: unknown;
  /** لون القسم (NeonColor) */
  color?: string;
  /** كلمات مفتاحية للبحث — تُدمج تلقائياً مع مرادفات categorySynonyms */
  keywords?: string[];
  /** إعدادات نموذج إضافة الخدمة لهذا القسم (اختياري — له إعداد عام) */
  fields?: SectionFieldConfig;
  /** المفتاح الحقيقي للصف في public.categories (services.category_id) */
  dbId?: string | number;
  image?: string;
  isCustom?: boolean;
}

// ---------------------------------------------------------------------------
// حالات الخدمة — Constants موحدة (labels + classes) لكل التطبيق
// ---------------------------------------------------------------------------

/** ثوابت الحالات (تُستخدم بدل النصوص المباشرة في المقارنات) */
export const SERVICE_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

/** التسميات المعروضة لكل حالة — المكان الوحيد لتغيير نصوص الحالات. */
export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  pending: 'بانتظار المراجعة',
  approved: 'معتمدة',
  rejected: 'مرفوضة',
  archived: 'مؤرشفة',
  deleted: 'محذوفة',
};

/** التسمية المعروضة لحالة الخدمة (نفس سلوك لوحة الإدارة السابق). */
export function serviceStatusLabel(status?: ServiceStatus): string {
  if (status === 'pending') return SERVICE_STATUS_LABELS.pending;
  if (status === 'rejected') return SERVICE_STATUS_LABELS.rejected;
  return SERVICE_STATUS_LABELS.approved;
}

/** أصناف شارة الحالة داخل لوحة الإدارة (خلفية شفافة + نص ملون). */
export function serviceStatusBadgeClass(status?: ServiceStatus): string {
  if (status === 'rejected') return 'bg-red-500/10 text-red-500';
  if (status === 'pending') return 'bg-amber-500/10 text-amber-600';
  return 'bg-[var(--accent-soft)] text-[var(--accent-primary)]';
}

/** تأثير الحالة على البطاقة/الصورة (تعتيم + تشبع) — موحد بين البطاقات والتفاصيل. */
export function serviceStatusOverlayClass(status?: ServiceStatus): string {
  return `${status === 'pending' ? 'opacity-70 saturate-50' : ''} ${status === 'rejected' ? 'opacity-50 saturate-0' : ''}`.trim();
}

// ---------------------------------------------------------------------------
// أسماء بديلة واضحة للأنواع الأساسية الأخرى
// ---------------------------------------------------------------------------

/** إشعار الإدارة (من lib/notifications — المصدر الفعلي للشكل). */
export type Notification = AdminNotification;

/** اقتراح مستخدم (صف من جدول الاقتراحات/التعليقات — الشكل الفعلي في useComments). */
export type UserSuggestion = Comment;
