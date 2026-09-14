import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  BROWSE_SLIDER_FRAME_CLASS,
  getSliderSwipeAction,
} from '../src/data/slideStyles';

const jobsSliderSource = readFileSync(new URL('../src/features/jobs/JobsSlider.tsx', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('../src/pages/Home.tsx', import.meta.url), 'utf8');
const slideViewSource = readFileSync(new URL('../src/features/jobs/JobSlideView.tsx', import.meta.url), 'utf8');

test('سلايدر الوظائف والتصفح يستخدمان إطار المقاس نفسه', () => {
  assert.match(BROWSE_SLIDER_FRAME_CLASS, /max-w-5xl/);
  assert.match(BROWSE_SLIDER_FRAME_CLASS, /h-\[165px\]/);
  assert.match(BROWSE_SLIDER_FRAME_CLASS, /md:h-\[230px\]/);
  assert.match(BROWSE_SLIDER_FRAME_CLASS, /rounded-3xl/);
  assert.match(homeSource, /className=\{`\$\{BROWSE_SLIDER_FRAME_CLASS\} group`\}/);
  assert.match(jobsSliderSource, /className=\{`\$\{BROWSE_SLIDER_FRAME_CLASS\}/);
});

test('السحب اليدوي موحّد للمس والماوس باتجاه RTL', () => {
  assert.equal(getSliderSwipeAction(200, 120), 'next');
  assert.equal(getSliderSwipeAction(120, 200), 'previous');
  assert.equal(getSliderSwipeAction(120, 145), null);
  assert.match(jobsSliderSource, /onPointerDown=\{onPointerDown\}/);
  assert.match(jobsSliderSource, /onPointerUp=\{finishPointer\}/);
  assert.match(jobsSliderSource, /event\.pointerType === 'mouse'/);
  assert.doesNotMatch(jobsSliderSource, /onTouchStart|onTouchEnd/);
});

test('لا توجد أسهم أو تنقل تلقائي أو نقاط قابلة للنقر', () => {
  assert.doesNotMatch(jobsSliderSource, /ChevronLeft|ChevronRight/);
  assert.doesNotMatch(jobsSliderSource, /aria-label="الشريحة السابقة"|aria-label="الشريحة التالية"/);
  assert.doesNotMatch(jobsSliderSource, /s\.autoplay/);
  assert.match(jobsSliderSource, /<span\s+key=\{`dot-/);
});

test('صور الوظائف تدعم أول صورة eager والبقية lazy وصورة بديلة وربط التفاصيل', () => {
  assert.match(jobsSliderSource, /index === 0 \? 'eager' : 'lazy'/);
  assert.match(slideViewSource, /slide\.imageUrl \|\| linkedJob\?\.image \|\| FALLBACK_IMAGE/);
  assert.match(slideViewSource, /linkedJob\?\.company/);
  assert.match(slideViewSource, /linkedJob\?\.title/);
  assert.match(slideViewSource, /line-clamp-2/);
  assert.match(slideViewSource, /className="absolute inset-0 z-10"/);
  assert.match(slideViewSource, /object-contain/);
  assert.match(slideViewSource, /object-cover/);
});
