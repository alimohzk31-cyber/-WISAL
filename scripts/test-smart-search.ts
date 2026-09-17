import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categories } from '../src/data/categories';
import { buildCategoryDirectory, directorySections } from '../src/data/categoryDirectory';
import { buildDirectorySearchIndex, searchDirectory, getDirectDirectoryMatch } from '../src/lib/directorySearch';
import { categoryUrl } from '../src/lib/directoryNavigation';

const index = buildDirectorySearchIndex(buildCategoryDirectory(categories).sections);
const top = (query: string): string => {
  const results = searchDirectory(index, query);
  assert.ok(results.length, `${query}: لا نتائج`);
  return results[0].url;
};

// عيّنة واحدة على الأقل لكل قسم من الأقسام الـ 71 المطلوبة.
const samples: Array<[string, string, string?]> = [
  ['سباك', 'plumbing'], ['كهربائي منازل', 'electrical'], ['أريد دوا', 'pharmacies'], ['أريد دكتور', 'doctors'],
  ['مستشفى أهلي', 'hospitals'], ['دكتور أسنان', 'doctors', 'dentist'], ['فحص نظر', 'doctors', 'ophthalmology'],
  ['أريد دكتور لابني', 'doctors', 'pediatrics'], ['حب شباب', 'doctors', 'dermatology'],
  ['عيادة بيطرية', 'pet-care', 'veterinary'], ['فحص دم', 'laboratories', 'medical-tests'],
  ['سونار طبي', 'laboratories', 'imaging'], ['ممرض منزلي', 'hospitals'], ['قبول جامعي', 'education'],
  ['تسجيل مدرسة', 'education', 'school'], ['كورس', 'education', 'institute'], ['مدرس خصوصي', 'education', 'tutor'],
  ['حضانة', 'sports', 'kids-area'], ['معرض سيارات', 'car-sales'], ['سيارتي ما تشتغل', 'cars', 'car-mechanic'],
  ['بطارية سيارة', 'cars', 'car-electric'], ['بنچر', 'cars', 'car-tires'], ['تبديل زيت', 'cars', 'oil-change'],
  ['قطع غيار سيارة', 'cars', 'spare-parts'], ['غسيل سيارات', 'cars', 'car-wash'], ['صبغ سيارة', 'cars', 'car-repair'],
  ['السبلت ما يبرد', 'cooling'], ['غسالتي خربت', 'home-services', 'appliance-repair'],
  ['شاشة موبايل', 'mobile-electronics', 'phone-repair'], ['تصليح لابتوب', 'computers'],
  ['راوتر', 'network-services'], ['نصب كاميرات', 'surveillance'], ['مقاول', 'construction'],
  ['أبو الحديد', 'doors-windows', 'iron-doors'], ['نجار', 'home-services', 'carpenter'],
  ['تركيب جام', 'aluminum-glass'], ['محتاج واحد يصبغ البيت', 'painting-decor', 'house-painting'],
  ['جبس بورد', 'painting-decor'], ['كاشي كار', 'marble-ceramics'], ['لبخ', 'painting-decor', 'gypsum'],
  ['عزل سطوح', 'construction', 'renovation'], ['تنظيف بيت', 'home-services', 'cleaning'],
  ['نقل عفش', 'shipping-delivery'], ['بيت للبيع', 'real-estate'], ['مطعم', 'food'],
  ['كاهي', 'food', 'bakery'], ['كليجة', 'food', 'sweets'], ['سوبرماركت', 'shopping', 'supermarket'],
  ['قصابة', 'food'], ['بائع خضار', 'shopping', 'supermarket'], ['هدوم', 'clothes'],
  ['درزن', 'tailoring'], ['قندرة', 'shoes-bags'], ['حلاق', 'beauty-care', 'salons'],
  ['كوافير', 'beauty-care', 'salons'], ['برفان', 'perfumes-cosmetics'], ['ذهب مستعمل', 'jewelry'],
  ['تصوير أعراس', 'media-production'], ['بنر', 'printing-services'], ['قاعة عرس', 'events', 'event-halls'],
  ['حجز فندق', 'travel-tourism', 'hotels'], ['فيزا', 'travel-tourism'], ['تكسي', 'transport'],
  ['دليفري', 'shipping-delivery'], ['محامي', 'legal', 'lawyer'], ['محاسب', 'accounting-finance'],
  ['مترجم', 'office-services', 'translation'], ['أريد شغل', 'employment'], ['جيم', 'sports'],
  ['تنسيق حدائق', 'gardening'], ['نجدة', 'public'],
];

test('each of the 71 requested service groups resolves to its existing section', () => {
  for (const [query, section, child] of samples) {
    assert.equal(top(query), categoryUrl(section, child), query);
  }
});

test('the normalized synonym index is reused for the same directory snapshot', () => {
  const directory = buildCategoryDirectory(categories);
  const services: [] = [];
  assert.strictEqual(
    buildDirectorySearchIndex(directory.sections, services),
    buildDirectorySearchIndex(directory.sections, services),
  );
  assert.deepEqual(searchDirectory(index, '   '), []);
});

test('iraqi natural sentences, filler words and context disambiguation', () => {
  const sentences: Array<[string, string, string?]> = [
    ['محتاج سباك', 'plumbing'], ['الحنفية تسرب ماي', 'plumbing'], ['أريد لوله', 'plumbing'],
    ['وين الكه سباك', 'plumbing'], ['محتاج سباك يصلح الحنفية', 'plumbing'],
    ['أريد صيدلية', 'pharmacies'], ['اريد صيدلية قريبه', 'pharmacies'],
    ['أدور على معهد', 'education', 'institute'],
    ['كهربائي بيت', 'electrical'], ['تاسيس كهرباء', 'electrical'],
    ['كهربائي سيارة', 'cars', 'car-electric'], ['بطارية موبايل', 'mobile-electronics', 'phone-repair'],
    ['صبغ بيت', 'painting-decor', 'house-painting'], ['دكتور طفل', 'doctors', 'pediatrics'],
  ];
  for (const [query, section, child] of sentences) assert.equal(top(query), categoryUrl(section, child), query);
  // «قطع غيار» وحدها كلمة مشتركة (سيارات/حاسبات) — تعرض الخيارين ولا تفتح قسمًا عشوائيًا.
  const spareResults = searchDirectory(index, 'قطع غيار');
  assert.ok(spareResults.some(result => result.url === categoryUrl('cars', 'spare-parts')));
  assert.ok(spareResults.length > 1);
  assert.equal(getDirectDirectoryMatch(spareResults), undefined);
  const sonarResults = searchDirectory(index, 'سونار');
  assert.ok(sonarResults.some(result => result.url === categoryUrl('laboratories', 'imaging')));
  assert.ok(sonarResults.some(result => result.url === categoryUrl('cars', 'car-sonar')));
  assert.equal(getDirectDirectoryMatch(sonarResults), undefined);
  for (const query of ['سونار سيارات', 'فحص سونار', 'فحص سيارة', 'فحص سيارات']) {
    assert.equal(top(query), categoryUrl('cars', 'car-sonar'), query);
  }
});

test('simple misspellings and dialect variants stay searchable', () => {
  for (const [query, expected] of [
    ['بنجرجي', categoryUrl('cars', 'car-tires')],
    ['ميكانيكك', categoryUrl('cars', 'car-mechanic')],
    ['كهربااء', categoryUrl('electrical')],
  ] as Array<[string, string]>) {
    const results = searchDirectory(index, query);
    assert.ok(results[0].url === expected || results.some(result => result.url === expected), query);
  }
});

test('administrative UI never appears in public search', () => {
  for (const query of ['الإدارة', 'admin', 'Admin Dashboard', 'إعدادات الإدارة', 'الموافقات']) {
    assert.deepEqual(searchDirectory(index, query), [], query);
  }
});

test('unclear queries never open a random section', () => {
  for (const query of ['ززززززز', '  ', 'هههه']) {
    assert.deepEqual(searchDirectory(index, query), [], query);
  }
  const ambiguous = searchDirectory(index, 'صيانة');
  assert.ok(ambiguous.length > 1);
  assert.equal(getDirectDirectoryMatch(ambiguous), undefined);
});

test('service search understands Iraqi intent phrases and profession synonyms', () => {
  const sections = [
    { ...directorySections.find(item => item.slug === 'accounting-finance')!, sources: [] },
    { ...directorySections.find(item => item.slug === 'cars')!, sources: [] },
  ];
  const services = [
    { name: 'مكتب حسابات', profession: 'محاسبة', location: 'كربلاء', categorySlug: 'accounting-finance', subCategory: undefined, slug: 'accounting-demo' },
    { name: 'ورشة سيارات', profession: 'فيتر سيارات', location: 'كربلاء', categorySlug: 'cars', subCategory: 'car-repair', slug: 'fitter-demo' },
  ] as any;
  const serviceIndex = buildDirectorySearchIndex(sections, services);
  for (const query of ['اريد محاسب', 'محتاج محاسب', 'اني فيتر اريد شغل', 'كربلاء']) {
    assert.ok(searchDirectory(serviceIndex, query).length > 0, `expected service result for ${query}`);
  }
});
