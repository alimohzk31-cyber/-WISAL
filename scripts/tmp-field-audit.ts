import { directorySections } from '../src/data/categoryDirectory';
import { categories } from '../src/data/categories';
import { GENERIC_FIELD_CONFIG, getCategoryFieldConfig } from '../src/data/categoryFields';
import { getServiceFormConfig } from '../src/lib/serviceFormConfig';
import { SECTION_FIELD_CONFIGS } from '../src/data/sectionFieldConfigs';
import assert from 'node:assert/strict';

const catSlugs = new Set(categories.map(c => c.slug));

function probe(slug: string) {
  const cfg = getCategoryFieldConfig(slug);
  return { slug, isGeneric: cfg === GENERIC_FIELD_CONFIG, hasReg: Boolean(cfg.registration), isCategory: catSlugs.has(slug) };
}

const missingSections: string[] = [];
const missingChildren: string[] = [];
let genericSections = 0;
let genericChildren = 0;

for (const section of directorySections) {
  const config = getServiceFormConfig({ slug: section.slug, name: section.name }, section.slug);
  if (config === GENERIC_FIELD_CONFIG || !SECTION_FIELD_CONFIGS[section.slug]) { missingSections.push(section.slug); genericSections++; }
  for (const ch of section.children) {
    const childConfig = getServiceFormConfig({ slug: section.slug, name: section.name }, section.slug, ch.slug);
    if (childConfig === GENERIC_FIELD_CONFIG) { missingChildren.push(`${section.slug}/${ch.slug}`); genericChildren++; }
  }
}

console.log('SECTIONS total=', directorySections.length, ' generic=', genericSections);
console.log('GENERIC SECTIONS:', missingSections.join(', '));
console.log('CHILDREN total=', directorySections.reduce((n, s) => n + s.children.length, 0), ' generic=', genericChildren);
console.log('GENERIC CHILDREN:', missingChildren.join(', '));

assert.equal(missingSections.length, 0, 'كل قسم رئيسي يجب أن يمتلك fields خاصة به');
assert.equal(missingChildren.length, 0, 'كل فرع يجب أن يُحل إلى fields غير عامة');
for (const section of directorySections) {
  const config = SECTION_FIELD_CONFIGS[section.slug];
  assert.ok(config.registration, `${section.slug}: registration مفقود`);
  assert.deepEqual(config.registration.images, { min: 1, max: 5 }, `${section.slug}: الصور يجب أن تكون 1–5`);
  assert.equal(config.registration.phoneRequired, true, `${section.slug}: الهاتف مطلوب`);
  for (const key of ['governorate', 'area', 'features']) {
    assert.ok(config.registration.fields.some(field => field.key === key), `${section.slug}: الحقل المشترك ${key} مفقود`);
  }
}

for (const slug of ['doctors', 'cars', 'food', 'digital-services', 'steel']) {
  const config = getServiceFormConfig({ slug, name: slug }, slug);
  assert.notEqual(config, GENERIC_FIELD_CONFIG, slug);
  assert.ok(config.nameLabel && config.profession && config.specialties.length > 0, `${slug}: إعداد ناقص`);
}
console.log('SAMPLES: doctors, cars, food, digital-services, steel OK');
