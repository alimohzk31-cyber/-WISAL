import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categories } from '../src/data/categories';
import { buildCategoryDirectory, directorySections, normalizeCategoryKey } from '../src/data/categoryDirectory';
import { smartCategorySearch } from '../src/lib/smartSearch';

test('all current local categories belong to the directory without extra duplicate roots', () => {
  const directory = buildCategoryDirectory(categories);
  assert.equal(directory.sections.length, directorySections.length);
  for (const category of categories) assert.ok(directory.locateCategory(category.slug), category.slug);
  assert.equal(new Set(directory.sections.map(item => normalizeCategoryKey(item.name))).size, directory.sections.length);
  for (const section of directory.sections) {
    assert.equal(new Set(section.children.map(item => item.slug)).size, section.children.length);
  }
});

test('the twenty requested fields are main sections with specialties', () => {
  const names = ['الطاقة الشمسية', 'الحاسبات والكمبيوتر', 'الكاميرات وأنظمة المراقبة', 'العقارات', 'السفر والسياحة', 'الشحن والتوصيل', 'الأثاث والمفروشات', 'الألمنيوم والزجاج', 'الصبغ والديكور', 'تنقية ومعالجة المياه', 'خدمات المناسبات', 'الزهور والهدايا', 'الخياطة والتفصيل', 'المكتبات والقرطاسية', 'التصوير والإنتاج الإعلامي', 'المحاسبة والخدمات المالية', 'التوظيف والخدمات المهنية', 'رعاية الحيوانات', 'الأمن والسلامة', 'النقل والمواصلات'];
  for (const name of names) assert.ok(directorySections.find(item => item.name === name)?.children.length, name);
});

test('custom IDs and duplicate Arabic names resolve without changing source data', () => {
  const sources = [
    { slug: 'db-dentist', dbId: 42, name: 'أطباء الأسنان' },
    { slug: 'db-internal', dbId: 43, name: 'أطباء الباطنية' },
    { slug: 'db-phone', dbId: 44, name: 'محلات صيانة الموبايلات' },
    { slug: 'custom-a', dbId: 45, name: 'خدمة مخصصة جديدة' },
    { slug: 'custom-b', dbId: 46, name: 'خدمه مخصصه جديده' },
  ];
  const before = JSON.stringify(sources);
  const directory = buildCategoryDirectory([...sources, ...categories]);
  assert.deepEqual(directory.locateCategory('db-dentist'), { sectionSlug: 'doctors', childSlug: 'dentist' });
  assert.deepEqual(directory.locateCategory('db-internal'), { sectionSlug: 'doctors', childSlug: 'internal-medicine' });
  assert.equal(directory.locateCategory('db-phone')?.sectionSlug, 'mobile-electronics');
  assert.equal(directory.locateCategory('custom-b')?.sectionSlug, 'custom-a');
  assert.equal(directory.sections.length, directorySections.length + 1);
  assert.equal(directory.locateService({ categorySlug: '', categoryId: 42 })?.childSlug, 'dentist');
  assert.equal(JSON.stringify(sources), before);
});

test('legacy links and car specialties remain accessible', () => {
  const directory = buildCategoryDirectory(categories);
  for (const [slug, expected] of [['dentist', 'doctors'], ['school', 'education'], ['university', 'education'], ['cafe', 'food'], ['car-electric', 'cars'], ['electrician', 'electrical'], ['real-estate', 'real-estate']]) {
    assert.equal(directory.locateCategory(slug)?.sectionSlug, expected);
  }
  for (const slug of ['oil-change', 'car-wash', 'car-tires', 'spare-parts', 'car-filters', 'car-glass', 'car-rental']) {
    assert.deepEqual(directory.locateService({ categorySlug: 'car-repair', subCategory: slug }), { sectionSlug: 'cars', childSlug: slug });
  }
});

test('moved specialties retain their old routes and service identifiers', () => {
  const directory = buildCategoryDirectory(categories);
  for (const [oldSection, childSlug, sectionSlug] of [['aluminum-glass', 'windows', 'doors-windows'], ['books-stationery', 'photocopy', 'printing-services'], ['digital-services', 'design', 'marketing']]) {
    const expected = { sectionSlug, childSlug };
    assert.deepEqual(directory.resolveRoute(oldSection, childSlug), expected);
    const service = Object.freeze({ categorySlug: oldSection, subCategory: childSlug });
    assert.deepEqual(directory.locateService(service), expected);
    assert.equal(service.categorySlug, oldSection);
  }
  assert.deepEqual(directory.resolveRoute('car-repair'), { sectionSlug: 'cars' });
  assert.deepEqual(directory.resolveRoute('dentist'), { sectionSlug: 'doctors', childSlug: 'dentist' });
  assert.deepEqual(directory.resolveRoute('cars', 'dentist'), { sectionSlug: 'cars' });
  assert.deepEqual(directory.locateCategory('solar-panels'), { sectionSlug: 'solar-energy', childSlug: 'solar-panels' });
  assert.deepEqual(directory.locateCategory('vocational-training'), { sectionSlug: 'education', childSlug: 'vocational-training' });
});

test('overlapping professions have exactly one display destination', () => {
  const directory = buildCategoryDirectory(categories);
  for (const [categorySlug, profession, expected] of [
    ['clinic', 'طبيب بيطري', 'pet-care'], ['clinic', 'طب أطفال', 'doctors'],
    ['construction', 'صباغ', 'painting-decor'], ['appliance-repair', 'صيانة ثلاجات', 'cooling'],
    ['surveillance', 'أجهزة إنذار', 'security-safety'], ['car-repair', 'كهرباء سيارات', 'cars'],
  ]) {
    const service = Object.freeze({ categorySlug, profession });
    const result = directory.locateService(service);
    assert.equal(result?.sectionSlug, expected, profession);
    assert.equal(directory.sections.filter(section => section.slug === result?.sectionSlug).length, 1);
  }
  assert.equal(directory.locateService({ categorySlug: 'clinic', profession: 'تخصص غير محدد' })?.sectionSlug, 'doctors');
});

test('search finds parent sections by specialty and keeps administrative queries blocked', () => {
  const { sections } = buildCategoryDirectory(categories);
  for (const [query, expected] of [['أسنان', 'doctors'], ['باطنية', 'doctors'], ['تبديل زيوت', 'cars'], ['دروس خصوصية', 'education'], ['إنفرترات', 'solar-energy'], ['بيطري', 'pet-care'], ['DVR', 'surveillance'], ['صباغ', 'painting-decor']]) {
    const result = smartCategorySearch(sections, [], query);
    assert.ok(result.some(item => item.slug === expected), `${query}: ${result.map(item => item.slug)}`);
    assert.equal(new Set(result.map(item => item.slug)).size, result.length);
  }
  assert.deepEqual(smartCategorySearch(sections, [], 'admin'), []);
  assert.deepEqual(smartCategorySearch(sections, [], 'الموافقات'), []);
});
