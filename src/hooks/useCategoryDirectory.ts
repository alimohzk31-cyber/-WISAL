import { buildCategoryDirectory } from '../data/categoryDirectory';
import type { SourceCategory } from '../data/categoryDirectory';
import type { Service } from './useServices';

type Directory = ReturnType<typeof buildCategoryDirectory>;
type GroupedDirectory = Directory & { bySection: Map<string, Service[]>; searchServices: Service[] };
// Separate public/admin inputs do not evict each other's calculations.
// Weak keys allow replaced snapshots and their indexes to be collected.
const directories = new WeakMap<SourceCategory[], Directory>();
const grouped = new WeakMap<SourceCategory[], WeakMap<Service[], GroupedDirectory>>();

export function useCategoryDirectory(categories: SourceCategory[], services: Service[]): GroupedDirectory {
  let directory = directories.get(categories);
  if (!directory) {
    directory = buildCategoryDirectory(categories);
    directories.set(categories, directory);
  }
  let byServices = grouped.get(categories);
  if (!byServices) { byServices = new WeakMap(); grouped.set(categories, byServices); }
  const existing = byServices.get(services);
  if (existing) return existing;
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
  const result = { ...directory, bySection, searchServices };
  byServices.set(services, result);
  return result;
}
