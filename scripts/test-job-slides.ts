// اختبار منطق سلايدر الوظائف (دوال خالصة لا تتطلب متصفحاً)
// التشغيل: npx tsx --test scripts/test-job-slides.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getJobSlideStatus, mergeJobSlideRow, mergeSettings, buildSlideDesignPayload,
  pickSlideDesign, JOB_SLIDER_SETTINGS_DEFAULTS, JOB_SLIDE_DEFAULTS,
} from '../src/features/jobs/jobSlideMeta';
import type { JobSlide, JobSliderSettings } from '../src/features/jobs/jobSlideMeta';

// 2026-09-12 محلياً
const NOW = new Date(2026, 8, 12, 10, 0, 0);

test('getJobSlideStatus: الحالات الأربع صحيحة', () => {
  assert.equal(getJobSlideStatus({ isVisible: true, startsAt: '', endsAt: '' }, NOW), 'active');
  assert.equal(getJobSlideStatus({ isVisible: false, startsAt: '', endsAt: '' }, NOW), 'hidden');
  assert.equal(getJobSlideStatus({ isVisible: true, startsAt: '2026-09-15', endsAt: '' }, NOW), 'upcoming');
  assert.equal(getJobSlideStatus({ isVisible: true, startsAt: '', endsAt: '2026-09-01' }, NOW), 'expired');
  // ضمن النافذة
  assert.equal(getJobSlideStatus({ isVisible: true, startsAt: '2026-09-10', endsAt: '2026-09-20' }, NOW), 'active');
  // يبدأ اليوم → فعال
  assert.equal(getJobSlideStatus({ isVisible: true, startsAt: '2026-09-12', endsAt: '' }, NOW), 'active');
  // ينتهي اليوم → فعال (ليس منتهياً بعد)
  assert.equal(getJobSlideStatus({ isVisible: true, startsAt: '', endsAt: '2026-09-12' }, NOW), 'active');
});

test('mergeJobSlideRow: صف كامل بأعمدة الترقية يُدمج سليماً', () => {
  const row = {
    id: 7, title: 'وظائف الآن', subtitle: 'تفاصيل', image_url: 'https://x/img.jpg',
    sort_order: 2, is_visible: true, button_text: 'قدّم الآن', button_link: '/jobs',
    starts_at: '2026-09-01', ends_at: null, text_position: 'left', text_vertical: 'top',
    title_size: 'large', subtitle_size: 'small', overlay_enabled: true, overlay_opacity: 0.6,
    image_fit: 'contain', show_dots: false,
  };
  const slide = mergeJobSlideRow(row);
  assert.equal(slide.id, 7);
  assert.equal(slide.buttonText, 'قدّم الآن');
  assert.equal(slide.buttonLink, '/jobs');
  assert.equal(slide.startsAt, '2026-09-01');
  assert.equal(slide.endsAt, '');
  assert.equal(slide.textPosition, 'left');
  assert.equal(slide.textVertical, 'top');
  assert.equal(slide.titleSize, 'large');
  assert.equal(slide.subtitleSize, 'small');
  assert.equal(slide.overlayEnabled, true);
  assert.equal(slide.overlayOpacity, 0.6);
  assert.equal(slide.imageFit, 'contain');
  assert.equal(slide.showDots, false);
});

test('mergeJobSlideRow: صف قديم بدون أعمدة الترقية يقع على الافتراضات', () => {
  const row = { id: 3, title: 'قديم', subtitle: null, image_url: 'u', sort_order: 1, is_visible: true };
  const slide = mergeJobSlideRow(row);
  assert.equal(slide.buttonText, JOB_SLIDE_DEFAULTS.buttonText);
  assert.equal(slide.startsAt, '');
  assert.equal(slide.textPosition, JOB_SLIDE_DEFAULTS.textPosition);
  assert.equal(slide.overlayEnabled, JOB_SLIDE_DEFAULTS.overlayEnabled);
  assert.equal(slide.overlayOpacity, JOB_SLIDE_DEFAULTS.overlayOpacity);
  assert.equal(slide.showDots, JOB_SLIDE_DEFAULTS.showDots);
});

test('buildSlideDesignPayload: يُبنى snake_case مع تحويل التاريخ الفارغ إلى null', () => {
  const payload = buildSlideDesignPayload({ buttonText: 'عرض الوظائف', startsAt: '', endsAt: '2026-10-01', overlayOpacity: 0.3 } as Partial<JobSlide>);
  assert.equal(payload.button_text, 'عرض الوظائف');
  assert.equal(payload.starts_at, null);
  assert.equal(payload.ends_at, '2026-10-01');
  assert.equal(payload.overlay_opacity, 0.3);
  assert.equal('title' in payload, false);
});

test('pickSlideDesign: يعيد camelCase للحقول التصميمية فقط', () => {
  const picked = pickSlideDesign({ buttonText: 'x', imageFit: 'cover', overlayEnabled: false } as Partial<JobSlide>);
  assert.deepEqual(picked, { buttonText: 'x', imageFit: 'cover', overlayEnabled: false });
});

test('mergeSettings: صف كامل + صف فارغ يعيد الافتراضات', () => {
  const settings = mergeSettings({ autoplay: false, duration_seconds: 7, loop_enabled: false, touch_drag: true, mobile_height: 'tall', corner_radius: 'rounded' });
  assert.deepEqual(settings, {
    autoplay: false, durationSeconds: 7, loop: false, touchDrag: true, mobileHeight: 'tall', cornerRadius: 'rounded',
  } satisfies JobSliderSettings);
  assert.deepEqual(mergeSettings(null), JOB_SLIDER_SETTINGS_DEFAULTS);
});
