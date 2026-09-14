// اختبار القسمين الجديدين: الاستقلالية، الظهور في الفهارس، والبحث
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { directorySections } from '../src/data/categoryDirectory';
import { categories } from '../src/data/categories';
import { SMART_SEARCH_VOCABULARY } from '../src/data/smartSearchVocabulary';
import { directorySearchAliases } from '../src/data/directorySearchAliases';

test('القسمان الجديدان موجودان في الدليل ومستقلان تماماً', () => {
  const carRental = directorySections.find(s => s.slug === 'car-rentals');
  const craneRental = directorySections.find(s => s.slug === 'crane-rentals');
  assert.ok(carRental, 'قسم تأجير سيارات موجود');
  assert.ok(craneRental, 'قسم تأجير كرينات موجود');
  assert.equal(carRental!.name, 'تأجير سيارات');
  assert.equal(craneRental!.name, 'تأجير كرينات');
  assert.equal(carRental!.children.length, 0, 'تأجير سيارات بلا فروع داخلية');
  assert.equal(craneRental!.children.length, 0, 'تأجير كرينات بلا فروع داخلية');
  // مستقل: ليس فرعاً داخل أي قسم آخر
  for (const s of directorySections) {
    assert.ok(!s.children.some(c => c.slug === 'car-rentals'), 'تأجير سيارات ليس فرعاً في أي قسم');
    assert.ok(!s.children.some(c => c.slug === 'crane-rentals'), 'تأجير كرينات ليس فرعاً في أي قسم');
  }
});

test('لم يتغير أي قسم أو فرع موجود (slugs وids ومابنق الأقسام)', () => {
  const sectionSlugs = directorySections.map(s => s.slug);
  assert.equal(new Set(sectionSlugs).size, sectionSlugs.length, 'لا تكرار في slugs الأقسام');
  // التحقق من وجود الأقسام الأساسية كما كانت
  for (const slug of ['doctors', 'hospitals', 'pharmacies', 'cars', 'car-sales', 'bike-sales',
    'construction', 'equipment-rental', 'transport', 'real-estate', 'food', 'public']) {
    assert.ok(sectionSlugs.includes(slug), `القسم ${slug} ما زال موجوداً`);
  }
  // الفروع القديمة لم تُمس
  const cars = directorySections.find(s => s.slug === 'cars')!;
  assert.ok(cars.children.some(c => c.slug === 'car-repair'), 'فرع car-repair ما زال داخل السيارات');
  assert.ok(cars.children.some(c => c.slug === 'car-rental'), 'فرع car-rental القديم ما زال داخل السيارات (لم يُحذف)');
  const equipment = directorySections.find(s => s.slug === 'equipment-rental')!;
  assert.ok(equipment.children.some(c => c.slug === 'crane-rental'), 'فرع crane-rental القديم ما زال داخل تأجير المعدات (لم يُحذف)');
});

test('القسمان في المصدر المركزي مع كامل إعدادات الانضمام (المحافظة والمنطقة إلزامية)', () => {
  const carRental = categories.find(c => c.slug === 'car-rentals');
  const craneRental = categories.find(c => c.slug === 'crane-rentals');
  assert.ok(carRental, 'تأجير سيارات في categories.ts');
  assert.ok(craneRental, 'تأجير كرينات في categories.ts');
  for (const c of [carRental!, craneRental!]) {
    assert.ok(c.fields?.registration, 'إعدادات التسجيل موجودة');
    const fields = c.fields.registration.fields;
    const govField = fields.find(f => f.key === 'governorate');
    const areaField = fields.find(f => f.key === 'area');
    assert.ok(govField?.required, 'المحافظة إلزامية');
    assert.ok(areaField?.required, 'المنطقة إلزامية');
    assert.equal(fields.filter(f => f.key === 'governorate').length, 1, 'حقل المحافظة يظهر مرة واحدة');
    assert.equal(fields.filter(f => f.key === 'area').length, 1, 'حقل المنطقة يظهر مرة واحدة');
    assert.ok(c.icon, 'أيقونة محددة');
  }
});

test('مفردات البحث تعرّف القسمين ولا تتعارض مع الأقسام الأخرى', () => {
  assert.ok((SMART_SEARCH_VOCABULARY['car-rentals'] ?? []).length > 5, 'مفردات تأجير سيارات');
  assert.ok((SMART_SEARCH_VOCABULARY['crane-rentals'] ?? []).length > 5, 'مفردات تأجير كرينات');
  assert.ok((directorySearchAliases['car-rentals'] ?? []).length > 3);
  assert.ok((directorySearchAliases['crane-rentals'] ?? []).length > 3);
  // التأكد من عدم تصادم المفاتيح: كل مفتاح slوg لقسم أو فرع
  const allSlugs = new Set<string>();
  for (const s of directorySections) { allSlugs.add(s.slug); s.children.forEach(c => allSlugs.add(c.slug)); }
  for (const key of [...Object.keys(SMART_SEARCH_VOCABULARY), ...Object.keys(directorySearchAliases)]) {
    assert.ok(allSlugs.has(key), `مفتاح البحث ${key} يشير إلى قسم موجود`);
  }
});
