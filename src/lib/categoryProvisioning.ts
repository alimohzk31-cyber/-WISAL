import { supabase } from './supabase';
import { fetchCategoryRows, invalidateCategoryRows } from './categoryRows';
import {
  directorySections,
  normalizeCategoryKey,
  type DirectoryChild,
  type DirectorySection,
} from '../data/categoryDirectory';

// ---------------------------------------------------------------------------
// تجهيز صف القسم المعروف في public.categories.
//
// الجذر الذي كان يُعطّل «انضم إلى القسم»: أقسام دليل وصال الكنسي (مثل
// «الأثاث والمفروشات» ← أثاث منزلي) قد لا يكون لها صف في public.categories،
// بينما services.category_id عمود FK لا يقبل إلا id صف موجود. فشل تحميل قائمة
// الأقسام العامة أو غياب الصف كان يُسقط الحفظ بالكامل رغم أن القسم معروف من
// المسار نفسه. هنا: نطابق الصف الموجود (slug/اسم/مرادفات) ونجهّزه مرة واحدة
// عند الغياب — بلا تخمين ولا قسم وهمي ولا fallback عام.
// ---------------------------------------------------------------------------

export interface SectionCategoryIdentity {
  /** slug القسم في الدليل الكنسي (furniture، cooling، ...). */
  sectionSlug: string;
  /** اسم القسم كما في الدليل. */
  sectionName: string;
  /** الفرع المحدد إن كان المطلوب فرعًا (مثل home-furniture). */
  childSlug?: string;
  childName?: string;
  /** المرادفات المعتمدة للمطابقة (slug واسم ومرادفات القسم/الفرع). */
  keys: string[];
}

/** هوية القسم/الفرع الكنسية لأي slug معروف في الدليل (قسم أو فرع). */
export function findSectionCategoryIdentity(categorySlug?: string | null): SectionCategoryIdentity | undefined {
  const slug = String(categorySlug ?? '').trim();
  if (!slug) return undefined;
  for (const section of directorySections) {
    if (section.slug === slug) {
      return { sectionSlug: section.slug, sectionName: section.name, keys: [section.slug, section.name, ...section.aliases] };
    }
    const child: DirectoryChild | undefined = section.children.find(sub => sub.slug === slug);
    if (child) {
      return {
        sectionSlug: section.slug,
        sectionName: section.name,
        childSlug: child.slug,
        childName: child.name,
        keys: [child.slug, child.name, ...child.aliases, section.slug, section.name, ...section.aliases],
      };
    }
  }
  return undefined;
}

interface CategoryRowLike {
  id?: unknown;
  slug?: unknown;
  name_ar?: unknown;
  name_en?: unknown;
  name?: unknown;
  [key: string]: unknown;
}

const tokens = (values: Array<unknown>): Set<string> => {
  const set = new Set<string>();
  for (const value of values) {
    if (value == null) continue;
    const raw = String(value).trim().toLowerCase();
    if (raw) set.add(raw);
    const normalized = normalizeCategoryKey(String(value));
    if (normalized) set.add(normalized);
  }
  return set;
};

const rowTokens = (row: CategoryRowLike): Set<string> =>
  tokens([row.slug, row.id, row.name_ar, row.name_en, row.name]);

/** يطابق صف DB ضد مفاتيح الفرع أولًا ثم مفاتيح القسم (الفرع أدق). */
function matchCategoryRow(
  rows: CategoryRowLike[],
  identity: SectionCategoryIdentity,
): CategoryRowLike | undefined {
  const childKeys = identity.childSlug
    ? tokens([identity.childSlug, identity.childName, ...identity.keys])
    : undefined;
  const sectionKeys = tokens(identity.keys);
  let sectionMatch: CategoryRowLike | undefined;
  for (const row of rows) {
    const rowSet = rowTokens(row);
    if (childKeys && [...childKeys].some(key => rowSet.has(key))) return row;
    if (!sectionMatch && [...sectionKeys].some(key => rowSet.has(key))) sectionMatch = row;
  }
  return sectionMatch;
}

const provisionedIds = new Map<string, string>();

/**
 * يعيد id صف public.categories المطابق للقسم/الفرع المعروف، ويجهّزه عند غيابه.
 * القسم غير المعروف في الدليل يعيد null (المتصل يعرض خطأ واضحًا) — لا يُخترع
 * أبدًا قسم عام لإخفاء الفشل.
 */
export async function ensureSectionCategoryRow(categorySlug?: string | null): Promise<string | null> {
  const slug = String(categorySlug ?? '').trim();
  if (!slug) return null;
  if (provisionedIds.has(slug)) return provisionedIds.get(slug)!;

  let rows: CategoryRowLike[] = [];
  try {
    rows = (await fetchCategoryRows()) as CategoryRowLike[];
  } catch (error) {
    console.error('[categoryProvisioning] fetchCategoryRows failed:', error);
  }

  // 1) مطابقة مباشرة بلا أي اعتماد على هوية الدليل.
  const direct = rows.find(row => String(row.slug ?? '') === slug || String(row.id ?? '') === slug);
  if (direct?.id != null) {
    const id = String(direct.id);
    provisionedIds.set(slug, id);
    return id;
  }

  // 2) القسم غير موجود حتى كصف: إن لم يكن معروفًا في الدليل فلا مجال للتخمين.
  const identity = findSectionCategoryIdentity(slug);
  if (!identity) return null;

  // 3) مطابقة دلالية (اسم/مرادفات) — القسم موجود في DB بslug مختلف.
  const matched = matchCategoryRow(rows, identity);
  if (matched?.id != null) {
    const id = String(matched.id);
    provisionedIds.set(slug, id);
    return id;
  }

  // 4) تجهيز الصف مرة واحدة (القسم المعروف يستحق صفًا حقيقيًا يخدم الـFK).
  const nameEn =
    [...identity.keys].find(key => /^[\x20-\x7E]+$/.test(key) && /[a-z]/i.test(key)) ?? slug;
  let parentId: string | null = null;
  if (identity.childSlug) {
    try {
      parentId = await ensureSectionCategoryRow(identity.sectionSlug);
    } catch (parentError) {
      console.error('[categoryProvisioning] parent row resolution failed:', { parent: identity.sectionSlug, parentError });
    }
  }
  const insertPayload: Record<string, unknown> = {
    id: slug,
    slug,
    name_ar: identity.childName ?? identity.sectionName,
    name_en: nameEn,
  };
  if (parentId) insertPayload.parent_id = parentId;
  const { error } = await supabase.from('categories').insert([insertPayload]);
  if (error) {
    // سباق مع جهاز آخر جهّز الصف نفسه: يعاد الاستعلام ويُقبل صفه.
    if (error.code === '23505') {
      invalidateCategoryRows();
      const refreshed = (await fetchCategoryRows(true)) as CategoryRowLike[];
      const existing = refreshed.find(row => String(row.slug ?? '') === slug || String(row.id ?? '') === slug);
      if (existing?.id != null) {
        const id = String(existing.id);
        provisionedIds.set(slug, id);
        return id;
      }
    }
    console.error('[categoryProvisioning] insert failed:', { slug, payload: insertPayload, error });
    return null;
  }
  invalidateCategoryRows();
  provisionedIds.set(slug, slug);
  return slug;
}
