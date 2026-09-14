import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildCategoryDirectory } from '../src/data/categoryDirectory';
import { useCategoryDirectory } from '../src/hooks/useCategoryDirectory';
import type { SourceCategory } from '../src/data/categoryDirectory';
import type { Service } from '../src/types/models';

const rentalCategories: SourceCategory[] = [
  { dbId: 901, slug: 'car-rentals', name: 'تأجير سيارات' },
  { dbId: 902, slug: 'crane-rentals', name: 'تأجير كرينات' },
];

function makePendingService(category: SourceCategory, id: number): Service {
  assert.ok(category.dbId != null, 'category_id must come from public.categories');
  return {
    id,
    slug: `safe-rental-flow-${id}`,
    name: `اختبار آمن ${category.name}`,
    profession: category.name,
    location: 'بغداد / الكرادة',
    image: '',
    categorySlug: category.slug,
    categoryId: category.dbId,
    createdAt: Date.now(),
    status: 'pending',
  };
}

for (const category of rentalCategories) {
  test(`${category.slug}: إضافة ← موافقة ← تصفح ← صفحة القسم`, () => {
    const directory = buildCategoryDirectory(rentalCategories);
    const section = directory.sections.find(item => item.slug === category.slug);
    assert.ok(section, 'القسم ظاهر ضمن صفحة الخدمات');
    assert.equal(section.children.length, 0, 'القسم رئيسي مستقل بلا فروع');
    assert.equal(directory.locateCategory(category.slug)?.sectionSlug, category.slug);
    assert.equal(directory.locateCategory(String(category.dbId))?.sectionSlug, undefined);

    const selectableCategories = rentalCategories.filter(item => item.dbId != null);
    const selectedCategory = selectableCategories.find(item => item.slug === category.slug);
    assert.ok(selectedCategory, 'القسم ظاهر في اختيار الانضمام');

    const pending = makePendingService(selectedCategory, Number(selectedCategory.dbId));
    assert.equal(pending.categorySlug, category.slug, 'الحفظ يستخدم slug نفسه');
    assert.equal(pending.categoryId, category.dbId, 'الحفظ يستخدم category_id الحقيقي');
    assert.equal(directory.locateService(pending)?.sectionSlug, category.slug, 'فلتر القسم يستخدم الربط نفسه');

    const beforeApproval = useCategoryDirectory(rentalCategories, [pending].filter(item => item.status === 'approved'));
    assert.equal(beforeApproval.bySection.get(category.slug)?.length ?? 0, 0, 'الخدمة pending لا تظهر للعامة');

    const approved: Service = { ...pending, status: 'approved' };
    const publicServices = [approved].filter(item => item.status === 'approved');
    const afterApproval = useCategoryDirectory(rentalCategories, publicServices);
    assert.equal(afterApproval.searchServices.some(item => item.id === approved.id), true, 'الخدمة تظهر في التصفح');
    assert.equal(afterApproval.bySection.get(category.slug)?.[0]?.id, approved.id, 'الخدمة نفسها تظهر داخل القسم الصحيح');
    assert.equal(afterApproval.locateService(approved)?.sectionSlug, category.slug);
  });
}

test('نموذج الإضافة يحفظ slug وcategory_id نفسيهما وCategoriesProvider يغلّف التطبيق', () => {
  const addServiceSource = readFileSync(new URL('../src/components/AddServiceModal.tsx', import.meta.url), 'utf8');
  assert.match(addServiceSource, /categorySlug:\s*selectedCategory\.slug/);
  assert.match(addServiceSource, /categoryId:\s*selectedCategory\.dbId/);
  assert.match(addServiceSource, /categories\.filter\(\(category: any\) => category\.dbId !== undefined && category\.dbId !== null\)/);

  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const providerOpen = appSource.indexOf('<CategoriesProvider>');
  const servicesOpen = appSource.indexOf('<ServicesProvider>');
  const routerOpen = appSource.indexOf('<HashRouter>');
  const providerClose = appSource.indexOf('</CategoriesProvider>');
  assert.ok(providerOpen >= 0 && providerOpen < servicesOpen && servicesOpen < routerOpen);
  assert.ok(routerOpen < providerClose, 'CategoriesProvider يغلّف الراوتر وكل مستهلكي useCategories');
});
