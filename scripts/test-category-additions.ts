import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categories } from '../src/data/categories';
import { buildCategoryDirectory } from '../src/data/categoryDirectory';
import { getCategoryFieldConfig } from '../src/data/categoryFields';
import { getServiceIcon, FALLBACK_SERVICE_ICON } from '../src/data/serviceIcons';
import { getCategoryIcon, CATEGORY_ICON_NAMES } from '../src/data/categoryIcons';
import { buildDirectorySearchIndex, searchDirectory } from '../src/lib/directorySearch';
import { canAddCategory, mergeCategoriesSafely } from '../src/lib/categoryValidation';

const storedClothing = Object.freeze({ slug: 'clothing', dbId: 'clothing', name: 'الملابس' });
const sources = [storedClothing, ...categories];
const directory = buildCategoryDirectory(sources);

test('new entry points preserve old links and do not duplicate their old child cards', () => {
  for (const [parent, slug] of [['building-materials', 'steel'], ['doors-windows', 'pvc'], ['shopping', 'clothes']]) {
    const promoted = directory.sections.find(section => section.slug === slug)!;
    const defaultChildSlug = promoted.defaultChildSlug ?? promoted.children[0]?.slug;
    assert.deepEqual(directory.resolveRoute(parent, slug), {
      sectionSlug: slug,
      ...(defaultChildSlug ? { childSlug: defaultChildSlug } : {}),
    });
    assert.equal(directory.sections.filter(section => section.slug === slug).length, 1);
    assert.ok(!directory.sections.find(section => section.slug === parent)!.children.some(child => child.slug === slug));
    assert.deepEqual(directory.locateService({ categorySlug: parent, subCategory: slug }), { sectionSlug: slug });
  }
  for (const slug of ['aluminum-glass', 'perfumes-cosmetics']) {
    assert.equal(directory.sections.filter(section => section.slug === slug).length, 1);
  }
});

test('clothing specialties use the existing category ID and profession field independently', () => {
  const expected = [
    ['ملابس نسائية', 'womens-clothes'], ['ملابس أطفال', 'kids-clothes'], ['ملابس رجالية', 'mens-clothes'],
  ];
  assert.deepEqual(directory.sections.find(section => section.slug === 'clothes')!.children.map(child => child.slug), expected.map(([, slug]) => slug));
  for (const [profession, childSlug] of expected) {
    assert.ok(getCategoryFieldConfig('clothing').specialties.includes(profession));
    const service = Object.freeze({ categorySlug: 'clothing', categoryId: 'clothing', profession });
    assert.deepEqual(directory.locateService(service), { sectionSlug: 'clothes', childSlug });
    assert.equal(service.categoryId, 'clothing');
  }
  assert.deepEqual(directory.locateService({ categorySlug: 'clothing', profession: 'أزياء رياضية' }), { sectionSlug: 'clothes' });
});

test('keywords reach smart search and all requested categories have icons', () => {
  for (const name of ['Factory', 'PanelsTopLeft', 'DoorOpen', 'SprayCan'] as const) {
    assert.ok(CATEGORY_ICON_NAMES.includes(name));
    assert.notEqual(getCategoryIcon(name), FALLBACK_SERVICE_ICON);
  }
  const index = buildDirectorySearchIndex(directory.sections);
  for (const [query, slug] of [['حديد تسليح', 'steel'], ['الومنيوم', 'aluminum-glass'], ['بي في سي', 'pvc'], ['كوزمتك', 'perfumes-cosmetics'], ['ملابس نسائية', 'clothes'], ['ملابس أطفال', 'clothes'], ['ملابس رجالية', 'clothes']]) {
    assert.ok(searchDirectory(index, query).some(result => result.section.slug === slug), query);
    assert.notEqual(getServiceIcon(slug), FALLBACK_SERVICE_ICON);
  }
});

test('safe merge preserves database IDs and prevents duplicate new categories', () => {
  for (const slug of ['steel', 'aluminum-glass', 'pvc', 'perfumes-cosmetics']) {
    const existing = { slug, dbId: `real-${slug}`, name: 'اسم محفوظ' };
    const metadata = { slug, name: categories.find(category => category.slug === slug)!.name };
    assert.equal(canAddCategory([existing], metadata).canAdd, false);
    const merged = mergeCategoriesSafely([existing], [metadata]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].dbId, existing.dbId);
    assert.equal(merged[0].name, existing.name);
  }
});
