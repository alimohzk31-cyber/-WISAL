import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { mapJob, newJobRow } from '../src/features/jobs/jobData';
import type { NewJob } from '../src/features/jobs/types';

const modalSource = readFileSync(new URL('../src/features/jobs/AddJobModal.tsx', import.meta.url), 'utf8');
const jobsHookSource = readFileSync(new URL('../src/features/jobs/useJobs.ts', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../src/features/jobs/JobsManager.tsx', import.meta.url), 'utf8');

const job: NewJob = {
  title: 'محاسب', company: '', specialty: 'محاسبة', description: '', requirements: 'خبرة سنتين',
  socialLinks: 'https://facebook.com/wisal\n07700000000', governorate: 'بغداد', area: 'الكرادة',
  employmentType: 'كامل', phone: '07700000000', categoryId: 3,
};

test('new job rows are pending, retain their selected category and map requirements to the legacy description column', () => {
  const row = newJobRow({ ...job, image: 'https://cdn/job.webp', images: ['https://cdn/job.webp'] });
  assert.equal(row.status, 'pending');
  assert.equal(row.title, 'محاسب');
  assert.equal(row.company, 'محاسب');
  assert.equal(row.category_id, 3);
  assert.equal(row.description, 'خبرة سنتين');
  assert.deepEqual(row.image_urls, ['https://cdn/job.webp']);
  assert.equal(row.image_url, 'https://cdn/job.webp');
  assert.equal(row.video_url, null);
  assert.equal(row.email, job.socialLinks);
  assert.equal(row.whatsapp, '07700000000');
});

test('the shared form keeps the requested fields in order and has a single replaceable image input', () => {
  const labels = [
    'عنوان الوظيفة', 'المهنة / الاختصاص', 'متطلبات الوظيفة', 'مواقع التواصل',
    'المحافظة', 'المنطقة', 'رقم الهاتف', 'نوع الوظيفة', 'الراتب (اختياري)',
    'الخبرة (اختياري)', 'صورة الوظيفة / صورة الشركة (صورة واحدة)',
  ];
  const positions = labels.map(label => modalSource.indexOf(`label="${label}"`));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.match(modalSource, /type="file" accept="image\/jpeg,image\/png,image\/webp"/);
  assert.doesNotMatch(modalSource, /multiple|videoInput|MAX_JOB_IMAGES|MAX_JOB_VIDEO/);
  assert.match(modalSource, /استبدال الصورة/);
  assert.match(modalSource, /const removeImage/);
});

test('the same form supports multiple job categories and is reused for administration edits', () => {
  const rows = [3, 9].map(categoryId => newJobRow({ ...job, categoryId }));
  assert.deepEqual(rows.map(row => row.category_id), [3, 9]);
  assert.match(adminSource, /import AddJobModal from '\.\/AddJobModal'/);
  assert.match(adminSource, /mode="edit"[\s\S]*?initialJob=\{job\}/);
  assert.match(modalSource, /initialEmploymentType\?/);
});

test('legacy jobs keep their old optional data readable while a new approved row appears in its assigned category', () => {
  const mapped = mapJob({
    id: 1, title: 'فني كهرباء', company: 'شركة وصال', specialty: 'كهربائي', description: 'وصف محفوظ سابقاً',
    requirements: 'خبرة عملية', governorate: 'بغداد', area: 'الكرادة', employment_type: 'كامل', phone: '0770',
    category_id: 9, email: 'contact@example.com', whatsapp: '07701112222',
    image_url: 'https://cdn/cover.webp', image_urls: ['https://cdn/other.webp'],
    video_url: 'https://cdn/legacy.mp4', company_about: 'نبذة قديمة', benefits: 'مزايا قديمة',
    qualification: 'دبلوم', created_at: '2026-09-14T00:00:00Z', status: 'approved',
  });
  assert.equal(mapped.status, 'approved');
  assert.equal(mapped.categoryId, 9);
  assert.equal(mapped.companyAbout, 'نبذة قديمة');
  assert.equal(mapped.benefits, 'مزايا قديمة');
  assert.equal(mapped.qualification, 'دبلوم');
  assert.equal(mapped.video, 'https://cdn/legacy.mp4');
  assert.equal(mapped.images?.length, 2);
  const row = newJobRow({ ...job, categoryId: 9 });
  assert.equal(row.status, 'pending');
  assert.match(adminSource, /status\(job,'approved'\)/);
  assert.match(jobsHookSource, /\.eq\('status', 'approved'\)/);
  assert.match(jobsHookSource, /media\.imageFile \? await uploadJobImage/);
});
