import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { mapJob, newJobRow } from '../src/features/jobs/jobData';
import {
  MAX_JOB_IMAGES, MAX_JOB_VIDEO_BYTES, MAX_JOB_VIDEO_SECONDS,
} from '../src/features/jobs/jobMediaConfig';
import type { NewJob } from '../src/features/jobs/types';

const modalSource = readFileSync(new URL('../src/features/jobs/AddJobModal.tsx', import.meta.url), 'utf8');
const jobsHookSource = readFileSync(new URL('../src/features/jobs/useJobs.ts', import.meta.url), 'utf8');
const jobsPageSource = readFileSync(new URL('../src/pages/jobs/JobsPage.tsx', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../src/features/jobs/JobsManager.tsx', import.meta.url), 'utf8');

const job: NewJob = {
  title: '  محاسب  ', company: '  شركة وصال  ', specialty: ' محاسبة ',
  description: ' تفاصيل الوظيفة ', governorate: ' بغداد ', area: ' الكرادة ',
  employmentType: 'كامل', phone: ' 07700000000 ', images: ['https://cdn/1.webp', 'https://cdn/2.webp'],
  image: 'https://cdn/1.webp', video: 'https://cdn/job.mp4',
};

test('صف الوظيفة يحفظ pending مع الصور المتعددة والفيديو', () => {
  const row = newJobRow(job, true);
  assert.equal(row.status, 'pending');
  assert.equal(row.title, 'محاسب');
  assert.deepEqual(row.image_urls, job.images);
  assert.equal(row.image_url, job.image);
  assert.equal(row.video_url, job.video);
});

test('قراءة الوظيفة تحافظ على الغلاف وكل الصور والفيديو', () => {
  const mapped = mapJob({
    id: 1, title: 'محاسب', company: 'وصال', specialty: 'محاسبة', description: 'تفاصيل',
    governorate: 'بغداد', area: 'الكرادة', employment_type: 'كامل', phone: '0770',
    image_url: 'https://cdn/cover.webp', image_urls: ['https://cdn/2.webp'],
    video_url: 'https://cdn/job.mp4', created_at: '2026-09-14T00:00:00Z', status: 'approved',
  });
  assert.deepEqual(mapped.images, ['https://cdn/cover.webp', 'https://cdn/2.webp']);
  assert.equal(mapped.image, 'https://cdn/cover.webp');
  assert.equal(mapped.video, 'https://cdn/job.mp4');
});

test('منتقي الصور يقبل ست صور مع معاينة وحذف ولا يحتوي إدخال رابط', () => {
  assert.equal(MAX_JOB_IMAGES, 6);
  assert.match(modalSource, /type="file"[^>]+multiple/);
  assert.match(modalSource, /URL\.createObjectURL\(file\)/);
  assert.match(modalSource, /removeImage\(index\)/);
  assert.doesNotMatch(modalSource, /type="url"|رابط الصورة/);
  assert.match(jobsHookSource, /media\.imageFiles\.map\(uploadJobImage\)/);
});

test('الفيديو واحد ومحدود ويُرفع عند الإرسال فقط', () => {
  assert.equal(MAX_JOB_VIDEO_BYTES, 20 * 1024 * 1024);
  assert.equal(MAX_JOB_VIDEO_SECONDS, 30);
  assert.match(modalSource, /const \[selectedVideo, setSelectedVideo\]/);
  assert.match(modalSource, /duration > MAX_JOB_VIDEO_SECONDS/);
  assert.match(jobsHookSource, /media\.videoFile \? await uploadJobVideo/);
  assert.doesNotMatch(modalSource, /uploadJobVideo/);
});

test('الإغلاق والمسح ورسالة النجاح تحدث بعد نجاح الحفظ فقط', () => {
  const awaitSave = modalSource.indexOf('await onSubmit(form');
  const reset = modalSource.indexOf('reset();', awaitSave);
  const close = modalSource.indexOf('onClose();', reset);
  const success = modalSource.indexOf("toast('success'", close);
  const catchBlock = modalSource.indexOf('catch (submitError)', success);
  assert.ok(awaitSave >= 0 && awaitSave < reset && reset < close && close < success && success < catchBlock);
  assert.match(modalSource.slice(catchBlock), /setError\(/);
});

test('واجهة الصفحة والنموذج متجاوبان والمراجعة تعتمد pending ثم approved', () => {
  assert.match(jobsPageSource, /max-w-6xl/);
  assert.match(jobsPageSource, /البحث والتصفية/);
  assert.match(modalSource, /h-\[100dvh\]/);
  assert.match(modalSource, /sm:max-w-2xl/);
  assert.match(modalSource, /overflow-y-auto/);
  assert.match(adminSource, /job\.status==='pending'/);
  assert.match(adminSource, /status\(job,'approved'\)/);
  assert.match(jobsHookSource, /\.eq\('status', 'approved'\)/);
});
