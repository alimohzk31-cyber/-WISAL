import { categories } from './categories';
import type { SectionFieldConfig } from '../types/models';
/**
 * إعدادات حقول نموذج "إضافة خدمة" لكل قسم.
 * الشكل (SectionFieldConfig) مُعرَّف مركزياً في types/models — المصدر الوحيد
 * للأنواع. CategoryFieldConfig هنا اسم بديل للتوافق مع الاستيرادات الحالية.
 *
 * *** المصدر الوحيد لإعدادات كل قسم — data/categories.ts → `fields`. ***
 * تم دمج كل إعدادات CATEGORY_FIELDS (القديمة) داخل بيانات القسم نفسه
 * في data/categories.ts الآن، بحيث إضافة قسم جديد أو تعديل إعدادات قسم
 * يحدث مرة واحدة في ملف واحد فقط.
 */
export type CategoryFieldConfig = SectionFieldConfig;
export type { SectionFieldConfig };

/** الإعداد العام لأي قسم لم يُعرَّف له إعداد خاص */
export const GENERIC_FIELD_CONFIG: CategoryFieldConfig = {
  nameLabel: 'اسم الخدمة / المحل',
  namePlaceholder: 'مثال: اسم الخدمة أو المحل',
  profession: '',
  specialties: [],
};

/** خريطة تحويل (alias) — بعض الأقسام قد تُستخدم بأسم مرادف.
 *  نعيد توجيهه تلقائياً ثم نقرأ الإعداد من data/categories.ts. */
const SLUG_ALIASES: Record<string, string> = {
  clothing: 'clothes',
};

/** يعيد إعداد الحقول للقسم المحدد مباشرةً من data/categories.ts (مصدر واحد). */
export function getCategoryFieldConfig(categorySlug?: string, fields?: SectionFieldConfig): CategoryFieldConfig {
  if (!categorySlug) return GENERIC_FIELD_CONFIG;
  const resolvedSlug = SLUG_ALIASES[categorySlug] ?? categorySlug;
  // 1) الأولوية القصوى: إعداد مُمرّر صراحة من الذاكرة (مثلاً من قاعدة بيانات)
  if (fields) return fields;
  // 2) إعداد الأقساط المُعرَّفة مركزياً في data/categories.ts (مكان واحد الآن)
  const embedded = categories.find((c) => c.slug === resolvedSlug)?.fields;
  if (embedded) return embedded;
  // 3) الإعداد العام
  return GENERIC_FIELD_CONFIG;
}

/** اسم القسم بالعربية (للعرض عند الحاجة) */
export function getCategoryName(categorySlug?: string): string {
  return categories.find((c) => c.slug === categorySlug)?.name ?? '';
}
