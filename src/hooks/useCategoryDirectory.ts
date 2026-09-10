import { buildCategoryDirectory } from '../data/categoryDirectory';
import type { SourceCategory } from '../data/categoryDirectory';
import type { Service } from './useServices';

// ---------------------------------------------------------------------------
// مشاركة الحساب الثقيل على مستوى الوحدة:
// buildCategoryDirectory + تجميع الخدمات حسب القسم كانت تُنفَّذ منفصلة في
// Home وCategoryPage وServicePage وSocialFeed وSmartSearchModal — أي 5 مرات
// لنفس البيانات عند كل انتقال/رسم. الآن تُحفظ النتيجة بمفتاح هوية المرجع
// (===) فلا يُعاد الحساب إلا عند تغيّر مصفوفة categories أو services فعلياً.
// ---------------------------------------------------------------------------
interface DirectoryMemo {
  categories: SourceCategory[];
  directory: ReturnType<typeof buildCategoryDirectory>;
}
let directoryMemo: DirectoryMemo | null = null;

interface GroupsResult {
  bySection: Map<string, Service[]>;
  searchServices: Service[];
}
interface GroupsMemo extends GroupsResult {
  categories: SourceCategory[];
  services: Service[];
}
let groupsMemo: GroupsMemo | null = null;

// Derive browsing data in memory; never pass these synthetic slugs to storage.
export function useCategoryDirectory(categories: SourceCategory[], services: Service[]) {
  const directory = directoryMemo && directoryMemo.categories === categories
    ? directoryMemo.directory
    : (directoryMemo = { categories, directory: buildCategoryDirectory(categories) }).directory;

  const groups = groupsMemo && groupsMemo.categories === categories && groupsMemo.services === services
    ? groupsMemo
    : (() => {
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
        return (groupsMemo = { categories, services, bySection, searchServices });
      })();

  return { ...directory, bySection: groups.bySection, searchServices: groups.searchServices };
}
