import type { Service } from '../types/models';

const CAR_SUBCATEGORY_SLUGS = new Set([
  'car-electric', 'oil-change', 'car-wash', 'spare-parts',
  'car-rental', 'car-tires', 'car-accessories', 'car-sonar', 'car-filters', 'car-glass',
]);

export interface CategoryLookup {
  idToSlug: Map<string, string>;
  slugToId: Map<string, string>;
}

/**
 * Accepts both Supabase category rows ({ id, slug }) and the serializable
 * category objects kept by useCategories ({ dbId, slug }).
 */
export function buildCategoryLookup(rows: unknown[]): CategoryLookup {
  const idToSlug = new Map<string, string>();
  const slugToId = new Map<string, string>();

  for (const value of rows) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    const rawId = row.id ?? row.dbId;
    const rawSlug = row.slug;
    if (rawId == null || rawSlug == null) continue;
    const id = String(rawId).trim();
    const slug = String(rawSlug).trim();
    if (!id || !slug) continue;
    idToSlug.set(id, slug);
    slugToId.set(slug, id);
  }

  return { idToSlug, slugToId };
}

export function categoryLookupHasRows(lookup: CategoryLookup): boolean {
  return lookup.idToSlug.size > 0;
}

/**
 * category_id is the database FK and therefore wins over a stale or missing
 * category_slug. The slug remains as a fallback for legacy rows whose FK is
 * absent or whose category is not present in the current category snapshot.
 */
export function resolveServiceCategory(
  row: Record<string, unknown>,
  lookup: CategoryLookup,
): Pick<Service, 'categoryId' | 'categorySlug' | 'subCategory'> {
  const rawId = row.category_id ?? row.categoryId;
  const categoryId = rawId == null || String(rawId).trim() === '' ? null : String(rawId);
  const storedSlugValue = row.category_slug ?? row.categorySlug;
  const storedSlug = storedSlugValue == null ? '' : String(storedSlugValue);
  const canonicalSlug = (categoryId ? lookup.idToSlug.get(categoryId) : undefined) || storedSlug;

  if (CAR_SUBCATEGORY_SLUGS.has(canonicalSlug)) {
    return { categoryId, categorySlug: 'car-repair', subCategory: canonicalSlug };
  }

  return {
    categoryId,
    categorySlug: canonicalSlug,
    subCategory: typeof row.subCategory === 'string' ? row.subCategory : undefined,
  };
}

/** Repairs older cached rows that were saved before the category lookup loaded. */
export function relinkCachedServiceCategories(
  services: Service[],
  lookup: CategoryLookup,
): Service[] {
  return services.map(service => ({
    ...service,
    ...resolveServiceCategory(service as unknown as Record<string, unknown>, lookup),
  }));
}
