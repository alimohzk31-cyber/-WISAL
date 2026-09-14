import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCategoryFieldConfig } from '../src/data/categoryFields';
import { getInitialProfession, getServiceFormConfig } from '../src/lib/serviceFormConfig';

test('display aliases resolve central fields without mutating stored identities', () => {
  const category = Object.freeze({ slug: 'legacy-pharmacy', name: 'الصيدليات', dbId: 'real-17' });
  const fields = getServiceFormConfig(category, 'pharmacies');
  assert.equal(fields, getCategoryFieldConfig('pharmacy'));
  assert.equal(fields.nameLabel, 'اسم الصيدلية');
  assert.equal(category.slug, 'legacy-pharmacy');
  assert.equal(category.dbId, 'real-17');
});

test('specialized pages and embedded fields use the same configuration resolver', () => {
  assert.equal(getServiceFormConfig({ slug: 'clinic', name: 'عيادة' }, 'doctors', 'dentist'), getCategoryFieldConfig('dentist'));
  assert.equal(getServiceFormConfig({ slug: 'steel', name: 'الحديد والصلب' }).nameLabel, 'اسم المحل / الشركة');
  const fields = { nameLabel: 'اسم مقدم الخدمة', namePlaceholder: 'مثال', profession: 'مختص', specialties: [] };
  assert.equal(getServiceFormConfig({ slug: 'custom-test', name: 'اختبار', fields }), fields);
});

test('specialty selection never displays an option that differs from the submitted value', () => {
  const pharmacy = getCategoryFieldConfig('pharmacy');
  assert.equal(getInitialProfession(pharmacy), '');
  assert.equal(getInitialProfession(pharmacy, 'مستلزمات طبية'), 'مستلزمات طبية');
  assert.equal(getInitialProfession(pharmacy, 'تخصص قسم آخر'), '');
  const cars = getServiceFormConfig({ slug: 'car-dealer', name: 'معرض سيارات' });
  assert.equal(getInitialProfession(cars, 'ياباني'), 'ياباني');
  assert.equal(cars.allowCustomSpecialty, false);
});

test('cars sonar uses the existing car category form and submits the exact specialty', () => {
  const sonar = getServiceFormConfig({ slug: 'car-repair', name: 'ورش سيارات' }, 'cars', 'car-sonar');
  assert.ok(sonar.specialties.includes('سونار'));
  assert.equal(getInitialProfession(sonar, 'سونار'), 'سونار');
});
