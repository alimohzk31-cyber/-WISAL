import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesJobSearch, normalizeJobSearch } from '../src/features/jobs/jobSearch';
import type { Job } from '../src/features/jobs/types';

function job(overrides: Partial<Job>): Job {
  return {
    id: 1, title: 'فني شبكات', company: 'شركة الفكر للإنترنت', specialty: 'تقنية المعلومات',
    description: 'تشغيل وصيانة شبكات مزود خدمة ISP وخدمة الزبائن',
    requirements: 'خبرة في أجهزة الاتصالات', governorate: 'كربلاء', area: 'حي الحسين',
    employmentType: 'كامل', phone: '07000000000', createdAt: new Date().toISOString(),
    status: 'approved', ...overrides,
  };
}

test('Arabic normalization removes hamza forms, diacritics, tatweel and extra spaces', () => {
  assert.equal(normalizeJobSearch('  إِنــتِرنت   وآلإتصالات '), 'انترنت والاتصالات');
});

test('internet and telecom synonyms match network and ISP content', () => {
  const candidate = job({});
  assert.equal(matchesJobSearch(candidate, 'إنترنت'), true);
  assert.equal(matchesJobSearch(candidate, 'اتصالات'), true);
  assert.equal(matchesJobSearch(candidate, 'شركة إنترنت'), true);
});

test('company, sales, accountant and location searches inspect all job fields', () => {
  assert.equal(matchesJobSearch(job({}), 'شركة الفكر'), true);
  assert.equal(matchesJobSearch(job({ title: 'موظف مخزن', description: 'مسؤول عن البيع وخدمة العملاء', specialty: 'مندوب مبيعات' }), 'مبيعات'), true);
  assert.equal(matchesJobSearch(job({ title: 'موظف مالي', specialty: 'حسابات' }), 'محاسب'), true);
  assert.equal(matchesJobSearch(job({}), 'حي الحسين'), true);
});

test('current approved company and area names are searchable', () => {
  const currentApprovedJob = job({
    title: 'محاسب', company: 'شركات بركات الرحمن', specialty: 'إدارة واقتصاد / محاسبة',
    governorate: 'كربلاء المقدسة', area: 'حي الحسين',
  });
  assert.equal(matchesJobSearch(currentApprovedJob, 'شركة'), true);
  assert.equal(matchesJobSearch(currentApprovedJob, 'شركات بركات الرحمن'), true);
  assert.equal(matchesJobSearch(currentApprovedJob, 'حي الحسين'), true);
  assert.equal(matchesJobSearch(currentApprovedJob, 'محاسب'), true);
  assert.equal(matchesJobSearch(currentApprovedJob, 'دوام كامل'), true);
});

test('unrelated content does not match', () => {
  assert.equal(matchesJobSearch(job({}), 'صيدلي سريري'), false);
});

test('Iraqi intent phrases keep only the profession and match its synonyms', () => {
  const accountant = job({ title: 'محاسب', specialty: 'محاسبة ومالية' });
  const administration = job({ title: 'موظف إداري', specialty: 'إدارة' });
  const sales = job({ title: 'موظف مبيعات', specialty: 'تسويق ومبيعات' });
  const fitter = job({ title: 'فني فيتر سيارات', specialty: 'ميكانيك وصيانة' });
  assert.equal(matchesJobSearch(accountant, 'اريد محاسب'), true);
  assert.equal(matchesJobSearch(accountant, 'اني محاسب اريد اشتغل'), true);
  assert.equal(matchesJobSearch(accountant, 'محتاج محاسب'), true);
  assert.equal(matchesJobSearch(administration, 'خريج ادارة'), true);
  assert.equal(matchesJobSearch(sales, 'اريد اشتغل مبيعات'), true);
  assert.equal(matchesJobSearch(fitter, 'اني فيتر اريد شغل'), true);
});
