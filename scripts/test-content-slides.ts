import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJobContentSlides, buildServiceContentSlides, resolveSlideImage } from '../src/lib/contentSlides';
import type { Job } from '../src/features/jobs/types';
import type { Service } from '../src/types/models';

const job = (values: Partial<Job> = {}): Job => ({
  id: 1, title: 'مهندس اتصالات', company: 'شركة الشبكات', specialty: 'اتصالات', description: '',
  governorate: '', area: '', employmentType: 'كامل', phone: '', createdAt: '2026-09-01', status: 'approved', ...values,
});
const service = (values: Partial<Service> = {}): Service => ({
  id: 1, slug: 'internet-company', name: 'شركة إنترنت', location: '', image: '', categorySlug: 'internet', createdAt: 1, status: 'approved', ...values,
});

test('only explicitly approved jobs and services enter their respective sliders', () => {
  assert.deepEqual(buildJobContentSlides([job(), job({ id: 2, status: 'pending' }), job({ id: 3, status: 'rejected' })]).map(slide => slide.id), ['job-1']);
  const services = [service(), ...(['pending', 'rejected', 'archived', 'deleted', undefined] as const).map((status, index) => service({ id: index + 2, status }))];
  assert.deepEqual(buildServiceContentSlides(services, []).map(slide => slide.id), ['service-1']);
});

test('one slide per item uses its primary image or first available image and real category', () => {
  const [jobSlide] = buildJobContentSlides([job({ image: 'cover.jpg', images: ['first.jpg', 'second.jpg'], categoryName: 'وظائف اتصالات' })]);
  assert.equal(jobSlide.imageUrl, 'cover.jpg');
  assert.equal(jobSlide.category, 'وظائف اتصالات');
  assert.equal(jobSlide.href, '/jobs/1');
  const slides = buildServiceContentSlides([service({ image: ' ', images: ['first.jpg', 'second.jpg'], categoryId: 9 })], [{ dbId: 9, slug: 'internet', name: 'شركة إنترنت' }]);
  assert.equal(slides.length, 1);
  assert.equal(slides[0].imageUrl, 'first.jpg');
  assert.equal(slides[0].category, 'شركة إنترنت');
  assert.equal(slides[0].href, '/service/1');
  assert.equal(buildServiceContentSlides([service({ image: 'main.jpg', images: ['extra.jpg'] })], [])[0].imageUrl, 'main.jpg');
});

test('updated approvals appear newest first and revoked approvals disappear without mutating input', () => {
  const jobs = [job(), job({ id: 2, status: 'pending', createdAt: '2026-09-14' })];
  assert.equal(buildJobContentSlides(jobs).length, 1);
  const approved = jobs.map(item => ({ ...item, status: 'approved' as const }));
  assert.deepEqual(buildJobContentSlides(approved).map(slide => slide.id), ['job-2', 'job-1']);
  assert.deepEqual(approved.map(item => item.id), [1, 2]);
  assert.deepEqual(buildJobContentSlides(approved.map(item => item.id === 2 ? { ...item, status: 'rejected' as const } : item)).map(slide => slide.id), ['job-1']);
  const services = [service({ reviewedAt: 3 }), service({ id: 2, reviewedAt: 8 })];
  assert.deepEqual(buildServiceContentSlides(services, []).map(slide => slide.id), ['service-2', 'service-1']);
  assert.deepEqual(services.map(item => item.id), [1, 2]);
});

test('resolveSlideImage يقبل كل أسماء الحقول الحقيقية ولا يخترع صورة', () => {
  assert.equal(resolveSlideImage({ image_url: 'data:image/jpeg;base64,AAA' }), 'data:image/jpeg;base64,AAA');
  assert.equal(resolveSlideImage({ imageUrl: 'https://cdn/wisal/1.webp' }), 'https://cdn/wisal/1.webp');
  assert.equal(resolveSlideImage({ image_path: 'jobs/1.webp' }), 'jobs/1.webp');
  assert.equal(resolveSlideImage({ image: '   ', image_url: 'https://real.jpg' }), 'https://real.jpg');
  assert.equal(resolveSlideImage({ images: ['  ', 'second.jpg'] }), 'second.jpg');
  assert.equal(resolveSlideImage({ image_urls: ['first.jpg'] }), 'first.jpg');
  assert.equal(resolveSlideImage('direct.jpg'), 'direct.jpg');
  assert.equal(resolveSlideImage({}), '');
  assert.equal(resolveSlideImage(undefined), '');
  assert.equal(resolveSlideImage({ image: null, images: [] }), '');
});

test('شرائح الخدمات تحمل معرّف الخدمة الحقيقي لجلب صورة الغلاف عند غيابها من القائمة', () => {
  const [serviceSlide] = buildServiceContentSlides([service({ id: 42, image: '' })], []);
  assert.equal(serviceSlide.serviceId, 42);
  assert.equal(serviceSlide.imageUrl, '');
  const [jobSlide] = buildJobContentSlides([job({ id: 7, image: '' })]);
  assert.equal(jobSlide.jobId, 7);
});

test('jobs and services with the same id remain distinct and empty lists never produce promotional slides', () => {
  const [jobSlide] = buildJobContentSlides([job()]);
  const [serviceSlide] = buildServiceContentSlides([service()], []);
  assert.notEqual(jobSlide.id, serviceSlide.id);
  assert.equal(jobSlide.title, 'مهندس اتصالات');
  assert.equal(serviceSlide.title, 'شركة إنترنت');
  assert.deepEqual(buildJobContentSlides([]), []);
  assert.deepEqual(buildServiceContentSlides([], []), []);
});
