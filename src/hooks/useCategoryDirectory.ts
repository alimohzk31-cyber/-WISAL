import { useMemo } from 'react';
import { buildCategoryDirectory } from '../data/categoryDirectory';
import type { SourceCategory } from '../data/categoryDirectory';
import type { Service } from './useServices';

// Derive browsing data in memory; never pass these synthetic slugs to storage.
export function useCategoryDirectory(categories: SourceCategory[], services: Service[]) {
  const directory = useMemo(() => buildCategoryDirectory(categories), [categories]);
  const serviceGroups = useMemo(() => {
    const bySection = new Map<string, Service[]>();
    const searchServices: Service[] = [];
    for (const service of services) {
      const placement = directory.locateService(service);
      if (!placement) continue;
      const items = bySection.get(placement.sectionSlug) ?? [];
      items.push(service);
      bySection.set(placement.sectionSlug, items);
      searchServices.push({ ...service, categorySlug: placement.sectionSlug, subCategory: placement.childSlug });
    }
    return { bySection, searchServices };
  }, [directory, services]);
  return { ...directory, ...serviceGroups };
}
