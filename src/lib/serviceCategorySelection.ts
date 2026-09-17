import { resolveDirectoryCategory } from '../data/categoryDirectory';

export interface ServiceCategoryOption {
  slug: string;
  name: string;
  dbId?: string | number | null;
  [key: string]: unknown;
}

export interface ServiceJoinContext {
  slug: string;
  childSlug?: string;
}

/** هوية القسم/الفرع كما تُمرَّر من صفحة القسم إلى النموذج (مصدر واحد للحقيقة). */
export interface ServiceJoinTarget {
  slug: string;
  name: string;
  dbId?: string | number;
  sectionSlug: string;
  childSlug?: string;
}

/** Resolve the DB-backed category used by AddServiceModal.
 *
 * الترتيب:
 *  1) الهدف الصريح القادم من صفحة القسم (by dbId ثم by slug).
 *  2) slug مباشر داخل قائمة الأقسام.
 *  3) عند الانضمام من قسم معروف بلا صف DB: نطابق القسم عبر موضعه في
 *     الدليل الكنسي بدل إرسال slug فارغ أو غير مرتبط.
 */
export function resolveServiceCategory(
  categories: ServiceCategoryOption[],
  initialCategorySlug?: string,
  joinSection?: ServiceJoinContext,
  explicitTarget?: ServiceJoinTarget,
): ServiceCategoryOption | undefined {
  if (explicitTarget?.dbId != null) {
    const byId = categories.find(
      category => category.dbId != null && String(category.dbId) === String(explicitTarget.dbId),
    );
    if (byId) return byId;
  }
  const requestedSlug = explicitTarget?.slug ?? initialCategorySlug;
  const requested = requestedSlug
    ? categories.find(category => category.slug === requestedSlug)
    : undefined;
  if (requested || !joinSection) return requested;

  return categories.find(category => {
    const placement = resolveDirectoryCategory(category);
    return placement?.sectionSlug === joinSection.slug &&
      (!joinSection.childSlug || placement.childSlug === joinSection.childSlug);
  });
}

/**
 * هدف الانضمام لصفحة القسم: هوية القسم/الفرع تُحدد من المسار نفسه (المعروف
 * دائمًا)، وتُقوّى بصف DB إن وُجد. لا يعتمد على تحميل قائمة الأقسام العامة،
 * ولا يُرجع undefined لقسم معروف — إن غاب صف DB فمسار الحفظ
 * (ensureSectionCategoryRow) يجهّزه، فيبقى الحفظ ممكنًا.
 */
export function pickJoinTarget(
  sources: Array<{ slug: string; name: string; dbId?: string | number }>,
  categories: ServiceCategoryOption[],
  joinSection: { slug: string; name?: string; childSlug?: string; childName?: string },
  locateCategory: (slug: string) => { sectionSlug: string; childSlug?: string } | undefined,
  _locateService?: unknown,
): ServiceJoinTarget {
  const sectionSlug = joinSection.slug;
  const childSlug = joinSection.childSlug;

  // 1) مصدر DB صريح تابع لهذا القسم (والفرع عند التحديد).
  for (const source of sources) {
    const slug = String(source.slug);
    const placement = locateCategory(slug);
    if (!placement || placement.sectionSlug !== sectionSlug) continue;
    if (childSlug && placement.childSlug && placement.childSlug !== childSlug) continue;
    return { slug, name: source.name, dbId: source.dbId, sectionSlug, childSlug };
  }

  // 2) أي خيار DB موضعه في الدليل يطابق القسم (والفرع).
  for (const option of categories) {
    if (option.dbId == null) continue;
    const placement = resolveDirectoryCategory(option);
    if (!placement || placement.sectionSlug !== sectionSlug) continue;
    if (childSlug && placement.childSlug && placement.childSlug !== childSlug) continue;
    return {
      slug: option.slug, name: option.name,
      dbId: option.dbId as string | number, sectionSlug, childSlug,
    };
  }

  // 3) المسار هو المرجع: فرع معروف يستحق slug خاصًا به، وإلا قسم الأب.
  const slug = childSlug ?? sectionSlug;
  return {
    slug,
    name: joinSection.childName ?? joinSection.name ?? sectionSlug,
    sectionSlug,
    childSlug,
  };
}
