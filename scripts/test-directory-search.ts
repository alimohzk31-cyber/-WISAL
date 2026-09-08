import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categories } from '../src/data/categories';
import { buildCategoryDirectory } from '../src/data/categoryDirectory';
import { buildDirectorySearchIndex, searchDirectory, getDirectDirectoryMatch } from '../src/lib/directorySearch';
import { categoryUrl } from '../src/lib/directoryNavigation';

const directory = buildCategoryDirectory(categories);
const index = buildDirectorySearchIndex(directory.sections);

test('all requested common phrases open the correct main section or specialty', () => {
  const cases: Array<[string[], string, string?]> = [
    [['مستشفى', 'مستشفيات'], 'hospitals'], [['صيدلية', 'صيدليات', 'أدوية'], 'pharmacies'],
    [['أسنان', 'طبيب أسنان', 'دكتور أسنان'], 'doctors', 'dentist'],
    [['سيارة', 'سيارات'], 'cars'], [['تبديل زيت', 'زيت سيارة'], 'cars', 'oil-change'],
    [['ميكانيكي', 'ميكانيك'], 'cars', 'car-mechanic'],
    [['جامعة أهلية'], 'education', 'private-universities'], [['دروس', 'مدرس خصوصي'], 'education', 'tutor'],
    [['سباك', 'صحيات'], 'plumbing'], [['كهربائي'], 'electrical'], [['مكيف', 'تبريد'], 'cooling'],
    [['هاتف', 'موبايل', 'تصليح موبايل'], 'mobile-electronics'], [['مطعم', 'أكل', 'وجبات'], 'food'],
    [['ذهب', 'صياغة'], 'jewelry'], [['كاميرات'], 'surveillance'], [['بيت للبيع', 'شراء بيت', 'إيجار'], 'real-estate'],
  ];
  for (const [queries, section, child] of cases) for (const query of queries) {
    const results = searchDirectory(index, query);
    assert.equal(getDirectDirectoryMatch(results)?.url, categoryUrl(section, child), `${query}: ${results.map(result => result.label).join(', ')}`);
  }
});

test('Arabic variants, spacing and simple misspellings remain searchable', () => {
  for (const query of ['  طَبِيبُ   أَسْنَانٍ ', 'دكتور اسنان', 'السلام عليكم اريد طبيب اسنان']) {
    assert.equal(getDirectDirectoryMatch(searchDirectory(index, query))?.url, categoryUrl('doctors', 'dentist'), query);
  }
  assert.equal(getDirectDirectoryMatch(searchDirectory(index, 'جامعه اهليه'))?.url, categoryUrl('education', 'private-universities'));
  const typo = searchDirectory(index, 'ميكانيكك');
  assert.ok(typo.some(result => result.url === categoryUrl('cars', 'car-mechanic')));
  assert.equal(getDirectDirectoryMatch(typo), undefined);
  assert.ok(searchDirectory(index, 'مستش').some(result => result.section.slug === 'hospitals'));
});

test('ambiguous phrases offer choices; unrelated phrases have no match', () => {
  const results = searchDirectory(index, 'صيانة');
  assert.ok(results.length > 1);
  assert.equal(getDirectDirectoryMatch(results), undefined);
  assert.deepEqual(searchDirectory(index, 'ززززززز'), []);
  assert.deepEqual(searchDirectory(index, '  '), []);
});

test('every main section and specialty has a public destination in the search index', () => {
  for (const section of directory.sections) {
    assert.ok(index.some(entry => entry.url === categoryUrl(section.slug)), section.name);
    assert.ok(searchDirectory(index, section.name).some(result => result.section.slug === section.slug), section.name);
    for (const child of section.children) assert.ok(index.some(entry => entry.url === categoryUrl(section.slug, child.slug)), child.name);
  }
  assert.equal(new Set(index.map(entry => entry.url)).size, index.length);
});

test('internal UI stays blocked while public administrative services can be found', () => {
  for (const query of ['الإدارة', 'Admin Dashboard', 'إعدادات الإدارة', 'لوحة التحكم', 'admin', 'الموافقات', 'إدارة صفحات admin', 'إعدادات إدارة صفحات']) {
    assert.deepEqual(searchDirectory(index, query), [], query);
  }
  assert.equal(getDirectDirectoryMatch(searchDirectory(index, 'إدارة صفحات'))?.url, categoryUrl('marketing', 'social-management'));
  assert.equal(getDirectDirectoryMatch(searchDirectory(index, 'إدارة أملاك'))?.url, categoryUrl('real-estate', 'property-management'));
  assert.equal(getDirectDirectoryMatch(searchDirectory(index, 'خدمات إدارية'))?.url, categoryUrl('office-services'));
  const sources = [...categories, { slug: 'admin', name: 'Admin Dashboard' }];
  const safeIndex = buildDirectorySearchIndex(buildCategoryDirectory(sources).sections);
  assert.ok(safeIndex.every(entry => !entry.url.includes('/admin')));
});

test('existing public service names use the display placement without mutating inputs', () => {
  const services = [Object.freeze({ slug: 'service-1', name: 'عيادة الندى', categorySlug: 'doctors', subCategory: 'dentist', location: '', image: '', createdAt: 1 })];
  const before = JSON.stringify(services);
  const serviceIndex = buildDirectorySearchIndex(directory.sections, services);
  assert.ok(searchDirectory(serviceIndex, 'عيادة الندى').some(result => result.url === categoryUrl('doctors', 'dentist')));
  assert.equal(JSON.stringify(services), before);
});

test('new fields are added or folded into the existing main field without duplicate roots', () => {
  for (const [query, expected] of [['الستائر والمفروشات', 'furniture'], ['البرامج والأنظمة', 'digital-services'], ['الصيانة العامة', 'home-services'], ['التدريب المهني', 'education']]) {
    assert.equal(getDirectDirectoryMatch(searchDirectory(index, query))?.section.slug, expected, query);
  }
  for (const name of ['الذهب والمجوهرات', 'الأجهزة المنزلية', 'مواد البناء', 'الأبواب والشبابيك', 'المصاعد', 'الألعاب والهوايات', 'العطور ومستحضرات التجميل', 'الأحذية والحقائب', 'خدمات الطباعة', 'التسويق والإعلانات', 'خدمات الإنترنت التقنية', 'الرخام والسيراميك', 'الحدائق والتشجير', 'تأجير المعدات', 'المكاتب والخدمات الإدارية', 'الخدمات الصناعية']) {
    assert.equal(directory.sections.filter(section => section.name === name).length, 1, name);
  }
});
