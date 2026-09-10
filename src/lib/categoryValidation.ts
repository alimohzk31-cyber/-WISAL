/**
 * Category Validation Helper
 * 
 * المسؤولية: منع إضافة أقسام مكررة في الواجهة.
 * 
 * القواعد:
 * - ممنوع duplicate slug
 * - ممنوع duplicate id (dbId) إذا كان موجوداً
 * - إذا وجد تكرار، يُستخدم الموجود ولا يُنشئ نسخة ثانية
 */

export interface ValidatableCategory {
  slug: string;
  dbId?: string | number | null;
  name?: string;
  icon?: string;
  color?: string;
  image?: string;
  isCustom?: boolean;
}

/**
 * تتحقق من وجود قسم مكرر وتدمج القوائم بأمان.
 * 
 * @param existing الأقسام الحالية (من الكاش أو الحالة)
 * @param incoming الأقسام الجديدة (من Supabase أو من الإضافة)
 * @returns قائمة مدمجة بدون تكرار
 * 
 * منطق الدمج:
 * - أولوية للـ dbId (المعرف الحقيقي من Supabase categories.id)
 * - إذا لم يوجد dbId، يُستخدم slug كمعرف
 * - الأقسام القديمة تبقى إذا لم تظهر مؤقتاً في النتيجة الجديدة
 * - البيانات الجديدة تُحدّد القديمة عند التطابق
 */
export function mergeCategoriesSafely(
  existing: ValidatableCategory[],
  incoming: ValidatableCategory[]
): ValidatableCategory[] {
  const map = new Map<string, ValidatableCategory>();

  // أولاً: نضع الأقسام الموجودة في الخريطة
  for (const cat of existing) {
    const key = getCategoryKey(cat);
    if (key && !map.has(key)) {
      map.set(key, { ...cat });
    }
  }

  // ثانياً: ندمج الأقسام الجديدة
  for (const cat of incoming) {
    const key = getCategoryKey(cat);
    if (!key) continue;

    const existingCat = map.get(key);
    if (existingCat) {
      // تحديث البيانات الموجودة مع الحفاظ على الـ dbId الأصلي
      map.set(key, {
        ...existingCat,
        ...cat,
        // نحتفظ بالـ dbId الأصلي إذا كان موجوداً
        dbId: existingCat.dbId ?? cat.dbId,
      });
    } else {
      // تحقق إضافي: منع تكرار slug حتى لو اختلف المفتاح
      const slugExists = Array.from(map.values()).some(
        (c) => c.slug === cat.slug
      );
      if (!slugExists) {
        map.set(key, { ...cat });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * يُرجع مفتاح فريد للقسم للاستخدام في الخريطة.
 * الأولوية للـ dbId (المعرف الحقيقي)، ثم slug.
 */
function getCategoryKey(cat: ValidatableCategory): string | null {
  if (cat.dbId != null && cat.dbId !== '') {
    return `id:${cat.dbId}`;
  }
  if (cat.slug) {
    return `slug:${cat.slug}`;
  }
  return null;
}

/**
 * تتحقق من إمكانية إضافة قسم جديد دون تكرار.
 * 
 * @param existing الأقسام الحالية
 * @param newCat القسم الجديد المراد إضافته
 * @returns { canAdd: boolean, reason?: string }
 */
export function canAddCategory(
  existing: ValidatableCategory[],
  newCat: ValidatableCategory
): { canAdd: boolean; reason?: string } {
  // تحقق من صحة البيانات الأساسية
  if (!newCat.slug || newCat.slug.trim() === '') {
    return { canAdd: false, reason: 'slug مطلوب' };
  }

  // تحقق من تكرار slug
  const duplicateSlug = existing.find(
    (c) => c.slug === newCat.slug
  );
  if (duplicateSlug) {
    return {
      canAdd: false,
      reason: `slug مكرر: ${newCat.slug} موجود بالفعل`,
    };
  }

  // تحقق من تكرار dbId إذا كان موجوداً
  if (newCat.dbId != null && newCat.dbId !== '') {
    const duplicateId = existing.find(
      (c) => c.dbId != null && String(c.dbId) === String(newCat.dbId)
    );
    if (duplicateId) {
      return {
        canAdd: false,
        reason: `dbId مكرر: ${newCat.dbId} موجود بالفعل`,
      };
    }
  }

  return { canAdd: true };
}
