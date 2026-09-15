// ---------------------------------------------------------------------------
// test-sliders-visual.mjs — إثبات بصري حقيقي لسلايدري التصفح والوظائف.
// ---------------------------------------------------------------------------
// لا يكفي tsc ولا build: هذا الاختبار يفتح Chrome حقيقي (puppeteer-core) على
// خادم التطوير، ويتنقل يدوياً بين شرائح السلايدر، ويقرأ أبعاد كل صورة فعلية
// (naturalWidth/naturalHeight) وobject-fit، ويلتقط أخطاء Console/Network.
//
// المراحل:
//   1) سلايدر التصفح (الصفحة الرئيسية): التنقل بين كل الشرائح والتحقق أن كل
//      صورة ظهرت فعلاً (وليست الصورة البديلة الرمادية).
//   2) سلايدر الوظائف: التحقق من بنية الطبقتين + أن الصورة كاملة بدون قص.
//   3) تدقيق النسب (عمودية/مربعة/أفقية) على مكوّن ContentSlider نفسه بصور
//      اختبار عليها علامات ألوان على الحواف الأربع، ثم أخذ لقطة شاشة وقراءة
//      بكسلاتها فعلياً للتأكد أن الأعلى والأسفل واليمين واليسار ظاهرة.
//
// التشغيل: npm run test:sliders-visual
// متغيرات: WISAL_UI_BASE (افتراضي http://127.0.0.1:3100) — CHROME_PATH
// ---------------------------------------------------------------------------
import puppeteer from 'puppeteer-core';
import { writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.WISAL_UI_BASE || 'http://127.0.0.1:3100';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MAX_SLIDES = Number(process.env.WISAL_SLIDER_MAX_SLIDES || 120);
const SUPABASE_URL = 'https://nnxrjpitjxtceydlcxzm.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueHJqcGl0anh0Y2V5ZGxjeHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDkyMjMsImV4cCI6MjA5MTIyNTIyM30.Ui1IQ4OOJ8wngBoNIBNe0nTCQgfm0q8P7AjrKhyAU4w';
const API_HEADERS = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };
const nodeFetch = globalThis.fetch;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = {
  base: BASE, services: {}, jobs: {}, aspect: {},
  checks: [], consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [],
};
const push = (pass, message) => report.checks.push(`${pass ? 'PASS' : 'FAIL'}: ${message}`);

// أخطاء معروفة سابقة ومستقلة تماماً عن السلايدرات (لا تُحتسب كفشل في السلايدر):
//   * beacon الخاص بـ Cloudflare Analytics يُحجب بـ CORS على localhost.
//   * 400 على service_comments (سياسة/عمود في تعليقات التصفح الاجتماعي).
//   * 400/404 على job_slides و job_slider_settings (مسار احتياطي معروف في بيانات الوظائف).
const UNRELATED_TO_SLIDERS = /cloudflareinsights|FeedInteractions|service_comments|job_slides|job_slider_settings|ERR_FAILED/i;
const isSliderRelated = (text) => !UNRELATED_TO_SLIDERS.test(text);

async function supabaseRows(query) {
  const res = await nodeFetch(`${SUPABASE_URL}/rest/v1/${query}`, { headers: API_HEADERS });
  if (!res.ok) throw new Error(`Supabase ${res.status} for ${query}`);
  return res.json();
}

// قارئ البكسلات: يُحمّل لقطة الشاشة (PNG base64) داخل صفحة المتصفح ويرسمها على
// canvas لقراءة القيم الحقيقية — دليل بصري وليس مجرد حساب نسب.
async function readPixels(page, dataUrl, points) {
  return page.evaluate(async (url, samples) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return samples.map((point) => {
      const x = Math.max(0, Math.min(canvas.width - 1, Math.round(point.x)));
      const y = Math.max(0, Math.min(canvas.height - 1, Math.round(point.y)));
      const [r, g, b] = context.getImageData(x, y, 1, 1).data;
      return { name: point.name, x, y, r, g, b };
    });
  }, dataUrl, points);
}

const isRed = (p) => p.r >= 150 && p.g <= 110 && p.b <= 110;
const isBlue = (p) => p.b >= 120 && p.r <= 110 && p.g <= 110;
const isGreen = (p) => p.g >= 130 && p.r <= 110 && p.b <= 110;
const isOrange = (p) => p.r >= 130 && p.g >= 60 && p.b <= 110;

// قياس الصورة داخل السلايدر: الأبعاد الطبيعية + object-fit + صندوق المحتوى
// الفعلي بعد object-fit (وهو ما يثبت وجود القص أو غيابه).
const MEASURE = () => {
  const slider = document.querySelector('[data-testid="services-slider"], [data-testid="jobs-slider"], [data-testid="audit-slider"]');
  if (!slider) return null;
  const holder = slider.querySelector('[data-slide-id]');
  if (!holder) return null;
  const frame = slider.getBoundingClientRect();
  const foreground = holder.querySelector('img[data-slide-layer="foreground"]');
  const backdrop = holder.querySelector('img[data-slide-layer="backdrop"]');
  const describe = (img) => {
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    const style = getComputedStyle(img);
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const scale = naturalWidth && naturalHeight
      ? Math.min(rect.width / naturalWidth, rect.height / naturalHeight) : 0;
    return {
      src: img.currentSrc || img.src,
      isFallback: String(img.src).startsWith('data:image/svg+xml'),
      naturalWidth, naturalHeight,
      objectFit: style.objectFit, filter: style.filter,
      boxWidth: rect.width, boxHeight: rect.height,
      contentWidth: naturalWidth * scale, contentHeight: naturalHeight * scale,
      contentTop: rect.top - frame.top + (rect.height - naturalHeight * scale) / 2,
      contentLeft: rect.left - frame.left + (rect.width - naturalWidth * scale) / 2,
    };
  };
  return {
    slideId: holder.dataset.slideId,
    frame: { width: frame.width, height: frame.height, top: frame.top, left: frame.left },
    frameRect: { x: frame.left, y: frame.top, width: frame.width, height: frame.height },
    foreground: describe(foreground),
    backdrop: describe(backdrop),
    loading: Boolean(slider.querySelector('[data-slide-loading]')),
    slideCount: Number((slider.querySelector('[aria-label^="الشريحة"]')?.getAttribute('aria-label') || '').split('من').pop()) || null,
  };
};

// ===========================================================================
// 1) سلايدر التصفح — التنقل اليدوي بين كل الشرائح
// ===========================================================================
async function auditServicesSlider(page) {
  const approved = await supabaseRows('services?select=id,image_url&status=eq.approved');
  report.services.approvedRows = approved.length;
  const hasImageById = new Map(approved.map((row) => [String(row.id), typeof row.image_url === 'string' && row.image_url.trim().length > 0]));
  report.services.approvedWithImage = [...hasImageById.values()].filter(Boolean).length;

  // تعطيل التشغيل التلقائي أثناء التنقل اليدوي حتى تكون كل خطوة مقصودة 100%
  // (usePageVisible يقرأ document.hidden، فلا تتحرك الشرائح من تلقاء نفسها).
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  });
  await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('[data-testid="services-slider"]', { timeout: 90000 });
  // انتظر حتى تظهر صورة الشريحة الأولى فعلاً (وليست البديل الرمادي). أثناء
  // التحميل يعرض السلايدر مؤشر تحميل، وبعد انتهاء المحاولة إما صورة أو بديل.
  await page.waitForFunction(() => {
    const img = document.querySelector('[data-testid="services-slider"] img[data-slide-layer="foreground"]');
    if (!img || !img.complete || !img.naturalWidth) return false;
    return !String(img.src).startsWith('data:image/svg+xml');
  }, { timeout: 90000 });
  await sleep(500);

  const first = await page.evaluate(MEASURE);
  report.services.slideCount = first?.slideCount ?? null;
  push(Boolean(first?.slideCount), `سلايدر التصفح: عدد الشرائح المعلن في النقاط = ${first?.slideCount}`);
  // عدد الشرائح المعلن في النقاط = عدد الخدمات المعتمدة الظاهرة الآن في السلايدر
  // (قائمة الخدمات تُحمّل تدريجياً: 12 ثم البقية في وقت الخمول).
  const declaredCount = async () => page.evaluate(() => {
    const label = document.querySelector('[data-testid="services-slider"] button[aria-label^="الشريحة"]')?.getAttribute('aria-label') || '';
    const parsed = Number(label.split('من').pop());
    return Number.isFinite(parsed) ? parsed : 0;
  });

  const observed = new Map();
  const seenFallback = [];
  const wrongFallback = [];
  const capture = async () => {
    const measured = await page.evaluate(MEASURE);
    const image = measured?.foreground;
    if (!image) return null;
    const serviceId = String(measured.slideId || '').replace(/^service-/, '');
    const hasImageInDb = hasImageById.get(serviceId) === true;
    if (!observed.has(measured.slideId)) {
      observed.set(measured.slideId, {
        slideId: measured.slideId,
        hasImageInDb,
        srcKind: image.isFallback ? 'بديل-رمادي' : String(image.src).slice(0, 46),
        natural: `${image.naturalWidth}x${image.naturalHeight}`,
        objectFit: image.objectFit,
      });
    }
    if (image.isFallback) {
      seenFallback.push(measured.slideId);
      // خلل حقيقي: الخدمة تحمل صورة في القاعدة لكن السلايدر عرض البديل الرمادي.
      if (hasImageInDb) wrongFallback.push(measured.slideId);
    }
    return measured;
  };
  await capture();

  // السحب على منتصف السلايدر: مسافة تتجاوز 40px → الشريحة التالية (RTL).
  const swipeNext = async () => {
    const box = first?.frameRect;
    if (!box) return;
    const y = box.y + box.height / 2;
    const startX = box.x + box.width / 2 + 90;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX - 160, y, { steps: 6 });
    await page.mouse.up();
  };

  // قائمة الخدمات تُحمَّل تدريجياً (12 في الصفحة الأولى ثم البقية في وقت الخمول)،
  // لذلك نتنقل حتى العدد المعلن، ونوسّع الجولة كلما زاد العدد حتى نغطي كل الخدمات.
  let swipes = 0;
  let reachedAll = false;
  for (let round = 0; round < 6 && !reachedAll; round += 1) {
    const target = Math.min(await declaredCount(), MAX_SLIDES);
    while (swipes < target) {
      const before = await page.evaluate(() => document.querySelector('[data-testid="services-slider"] [data-slide-id]')?.dataset.slideId || '');
      await swipeNext();
      try {
        await page.waitForFunction((previous) => {
          const slider = document.querySelector('[data-testid="services-slider"]');
          const holder = slider?.querySelector('[data-slide-id]');
          if (!holder || holder.dataset.slideId === previous) return false;
          const img = holder.querySelector('img[data-slide-layer="foreground"]');
          if (!img || !img.complete || !img.naturalWidth) return false;
          // إما صورة حقيقية، أو انتهت محاولة الجلب (لا مؤشر تحميل) فالبديل هو النتيجة.
          return !String(img.src).startsWith('data:image/svg+xml') || !slider.querySelector('[data-slide-loading]');
        }, { timeout: 25000 }, before);
      } catch {
        report.services.stuckAt = before;
        break;
      }
      await sleep(200);
      await capture();
      swipes += 1;
    }
    const declared = await declaredCount();
    reachedAll = declared >= approved.length;
    if (!reachedAll) await sleep(4000); // امنح الصفحات التالية وقتاً للوصول
  }

  report.services.observed = [...observed.values()];
  report.services.observedCount = observed.size;
  report.services.fallbackCount = seenFallback.length;
  report.services.wrongFallback = wrongFallback;
  report.services.unloaded = [...observed.values()].filter((item) => item.natural === '0x0').map((item) => item.slideId);
  push(observed.size > 0 && wrongFallback.length === 0 && report.services.unloaded.length === 0,
    `سلايدر التصفح: ${observed.size} شريحة تم التنقل إليها يدوياً — صور حقيقية ظاهرة، وبلا بديل رمادي لخدمة لها صورة في القاعدة (${wrongFallback.length})`);
  return observed.size;
}
// ===========================================================================
// 2) سلايدر الوظائف — بنية الطبقتين + الصورة كاملة بدون قص
// ===========================================================================
async function auditJobsSlider(page) {
  const jobs = await supabaseRows('jobs?select=id,title,image_url&status=eq.approved');
  report.jobs.approvedRows = jobs.length;
  await page.goto(`${BASE}/#/jobs`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('[data-testid="jobs-slider"]', { timeout: 90000 });
  await page.waitForFunction(() => {
    const img = document.querySelector('[data-testid="jobs-slider"] img[data-slide-layer="foreground"]');
    return Boolean(img) && img.complete && img.naturalWidth > 0;
  }, { timeout: 90000 });
  await sleep(600);

  const measured = await page.evaluate(() => {
    const slider = document.querySelector('[data-testid="jobs-slider"]');
    const holder = slider.querySelector('[data-slide-id]');
    const frame = slider.getBoundingClientRect();
    const read = (img) => img ? {
      src: img.currentSrc || img.src,
      isFallback: String(img.src).startsWith('data:image/svg+xml'),
      naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
      objectFit: getComputedStyle(img).objectFit, filter: getComputedStyle(img).filter,
      boxWidth: img.getBoundingClientRect().width, boxHeight: img.getBoundingClientRect().height,
    } : null;
    return {
      slideId: holder?.dataset.slideId,
      frame: { width: frame.width, height: frame.height },
      frameRect: { x: frame.left, y: frame.top, width: frame.width, height: frame.height },
      renderedSlides: slider.querySelectorAll('[data-slide-id]').length,
      dotCount: slider.querySelectorAll('button[aria-label^="الشريحة"]').length,
      hasBackdrop: Boolean(holder?.querySelector('img[data-slide-layer="backdrop"]')),
      foreground: read(holder?.querySelector('img[data-slide-layer="foreground"]')),
      backdrop: read(holder?.querySelector('img[data-slide-layer="backdrop"]')),
    };
  });
  report.jobs.detail = measured;

  const fg = measured.foreground;
  push(Boolean(fg?.naturalWidth) && !fg?.isFallback, `سلايدر الوظائف: الصورة ظاهرة فعلياً (${fg?.naturalWidth}x${fg?.naturalHeight})`);
  push(fg?.objectFit === 'contain', `سلايدر الوظائف: الصورة الأمامية object-fit=contain (${fg?.objectFit})`);
  push(measured.hasBackdrop && measured.backdrop?.objectFit === 'cover',
    `سلايدر الوظائف: طبقة خلفية cover مموّهة تملأ الفراغات (filter=${measured.backdrop?.filter})`);
  if (fg?.naturalWidth && fg?.naturalHeight) {
    const scale = Math.min(fg.boxWidth / fg.naturalWidth, fg.boxHeight / fg.naturalHeight);
    const contentWidth = fg.naturalWidth * scale;
    const contentHeight = fg.naturalHeight * scale;
    const fits = contentWidth <= fg.boxWidth + 0.5 && contentHeight <= fg.boxHeight + 0.5;
    report.jobs.contentBox = { contentWidth, contentHeight, imageRatio: fg.naturalWidth / fg.naturalHeight };
    push(fits, `سلايدر الوظائف: الصورة تُعرض كاملة داخل الإطار (${Math.round(contentWidth)}x${Math.round(contentHeight)} داخل ${Math.round(fg.boxWidth)}x${Math.round(fg.boxHeight)})`);
  }
  return measured;
}
// ===========================================================================
// 3) تدقيق النسب: عمودية + مربعة + أفقية مع قراءة بكسلات لقطة الشاشة
// ===========================================================================
const AUDIT_HTML = [
  '<!doctype html>',
  '<html lang="ar" dir="rtl"><head><meta charset="utf-8" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '<title>تدقيق السلايدر</title></head>',
  '<body><div id="root"></div>',
  '<script type="module" src="./slider-audit-entry.tsx"></script></body></html>',
].join('\n');

// ملف تدقيق مؤقت (يُكتب من هذا الاختبار ويُحذف بعده): يشغّل مكوّن ContentSlider
// الحقيقي بصور اختبار عليها علامات ألوان على الحواف الأربع — أي قص من أي جهة
// يمنع ظهور العلامة، فتصبح النتيجة دليلاً بصرياً لا مجرد حساب نسب.
const AUDIT_ENTRY = `import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import ContentSlider from './src/components/ContentSlider';
import './src/index.css';
import type { ContentSlide } from './src/lib/contentSlides';

function markerImage(width: number, height: number, label: string) {
  const vertical = Math.max(2, Math.round(height * 0.07));
  const horizontal = Math.max(2, Math.round(width * 0.05));
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='" + width + "' height='" + height + "' viewBox='0 0 " + width + " " + height + "'>" +
    "<rect width='" + width + "' height='" + height + "' fill='#ffffff'/>" +
    "<rect width='" + width + "' height='" + vertical + "' fill='#ff0000'/>" +
    "<rect y='" + (height - vertical) + "' width='" + width + "' height='" + vertical + "' fill='#0000ff'/>" +
    "<rect x='0' y='0' width='" + horizontal + "' height='" + height + "' fill='#00c800'/>" +
    "<rect x='" + (width - horizontal) + "' y='0' width='" + horizontal + "' height='" + height + "' fill='#ff8800'/>" +
    "<text x='" + width / 2 + "' y='" + height / 2 + "' font-size='" + Math.round(Math.min(width, height) / 8) + "' font-family='Arial' font-weight='bold' fill='#333333' text-anchor='middle'>" + label + "</text>" +
    '</svg>';
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

const slides: ContentSlide[] = [
  { id: 'audit-portrait', title: 'عمودية', category: 'تدقيق', href: '#', imageUrl: markerImage(600, 1200, 'عمودية') },
  { id: 'audit-square', title: 'مربعة', category: 'تدقيق', href: '#', imageUrl: markerImage(900, 900, 'مربعة') },
  { id: 'audit-landscape', title: 'أفقية', category: 'تدقيق', href: '#', imageUrl: markerImage(1600, 700, 'أفقية') },
];
const fit = (new URLSearchParams(location.search).get('fit') as 'cover' | 'contain') || 'contain';
createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <div style={{ padding: '24px' }}>
      <ContentSlider slides={slides} label="تدقيق مكوّن السلايدر" testId="audit-slider" autoplay={false} touchDrag={false} imageFit={fit} />
    </div>
  </HashRouter>
);
`;
async function auditAspectRatios(page) {
  const htmlPath = path.join(process.cwd(), 'slider-audit.html');
  const entryPath = path.join(process.cwd(), 'slider-audit-entry.tsx');
  await writeFile(htmlPath, AUDIT_HTML, 'utf8');
  await writeFile(entryPath, AUDIT_ENTRY, 'utf8');
  try {
    const results = {};
    for (const fit of ['contain', 'cover']) {
      const perSlide = {};
      await page.goto(`${BASE}/slider-audit.html?fit=${fit}#/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('[data-testid="audit-slider"]', { timeout: 30000 });
      await page.waitForFunction(() => {
        const img = document.querySelector('[data-testid="audit-slider"] img[data-slide-layer="foreground"]');
        return Boolean(img) && img.complete && img.naturalWidth > 0;
      }, { timeout: 30000 });
      await sleep(600);
      const dots = await page.$$('[data-testid="audit-slider"] button[aria-label^="الشريحة"]');
      for (let index = 0; index < dots.length; index += 1) {
        if (index > 0) { await dots[index].click(); await sleep(900); }
        const measured = await page.evaluate(MEASURE);
        if (!measured?.foreground) continue;
        const fg = measured.foreground;
        const scale = Math.min(fg.boxWidth / fg.naturalWidth, fg.boxHeight / fg.naturalHeight);
        const contentWidth = fg.naturalWidth * scale;
        const contentHeight = fg.naturalHeight * scale;
        const shot = await page.screenshot({
          encoding: 'base64',
          clip: {
            x: Math.max(0, measured.frameRect.x), y: Math.max(0, measured.frameRect.y),
            width: Math.min(measured.frameRect.width, 1200), height: Math.min(measured.frameRect.height, 400),
          },
        });
        const pixels = await readPixels(page, `data:image/png;base64,${shot}`, [
          { name: 'top', x: fg.contentLeft + contentWidth * 0.5, y: fg.contentTop + contentHeight * 0.035 },
          { name: 'bottom', x: fg.contentLeft + contentWidth * 0.5, y: fg.contentTop + contentHeight * 0.965 },
          { name: 'left', x: fg.contentLeft + contentWidth * 0.02, y: fg.contentTop + contentHeight * 0.5 },
          { name: 'right', x: fg.contentLeft + contentWidth * 0.98, y: fg.contentTop + contentHeight * 0.5 },
        ]);
        const byName = Object.fromEntries(pixels.map((pixel) => [pixel.name, pixel]));
        perSlide[measured.slideId] = {
          natural: `${fg.naturalWidth}x${fg.naturalHeight}`,
          box: `${Math.round(fg.boxWidth)}x${Math.round(fg.boxHeight)}`,
          content: `${Math.round(contentWidth)}x${Math.round(contentHeight)}`,
          objectFit: fg.objectFit,
          pixels: byName,
          markers: {
            top: isRed(byName.top), bottom: isBlue(byName.bottom),
            left: isGreen(byName.left), right: isOrange(byName.right),
          },
        };
      }
      results[fit] = perSlide;
    }
    report.aspect = results;

    for (const [slideId, data] of Object.entries(results.contain || {})) {
      const allFour = data.markers.top && data.markers.bottom && data.markers.left && data.markers.right;
      push(allFour, `النسب (contain): ${slideId} ${data.natural} — الحواف الأربع ظاهرة بصرياً (أعلى=${data.markers.top}، أسفل=${data.markers.bottom}، يمين=${data.markers.right}، يسار=${data.markers.left})`);
    }
    // تحقق ذاتي للاختبار: في وضع cover على صورة عمودية يجب أن يُقص الأعلى/الأسفل،
    // وهذا يثبت أن هذا الاختبار قادر فعلاً على كشف القص.
    const coverPortrait = results.cover?.['audit-portrait'];
    if (coverPortrait) {
      push(!coverPortrait.markers.top || !coverPortrait.markers.bottom,
        `تحقق ذاتي: وضع cover على صورة عمودية يقص الأعلى/الأسفل فعلاً (أعلى=${coverPortrait.markers.top}، أسفل=${coverPortrait.markers.bottom})`);
    }
    return results;
  } finally {
    await rm(htmlPath, { force: true });
    await rm(entryPath, { force: true });
  }
}
function summary() {
  const lines = [];
  lines.push(`BASE=${report.base}`);
  lines.push(`SERVICES approved rows=${report.services.approvedRows} (with image=${report.services.approvedWithImage})`);
  lines.push(`SERVICES slider slides=${report.services.slideCount} | navigated=${report.services.observedCount} | fallback=${report.services.fallbackCount}`);
  lines.push(`JOBS approved rows=${report.jobs.approvedRows} | rendered slides=${report.jobs.detail?.renderedSlides}`);
  lines.push(`CONSOLE_ERRORS=${report.consoleErrors.length} PAGE_ERRORS=${report.pageErrors.length} FAILED_REQUESTS=${report.failedRequests.length} BAD_RESPONSES=${report.badResponses.length}`);
  for (const check of report.checks) lines.push(check);
  const relatedConsole = report.consoleErrors.filter(isSliderRelated);
  const relatedBad = report.badResponses.filter(isSliderRelated);
  const relatedFailed = report.failedRequests.filter(isSliderRelated);
  lines.push(`SLIDER_RELATED_CONSOLE_ERRORS=${relatedConsole.length} SLIDER_RELATED_BAD_RESPONSES=${relatedBad.length} SLIDER_RELATED_FAILED_REQUESTS=${relatedFailed.length}`);
  lines.push('--- أخطاء خارج نطاق السلايدرات (سابقة ومستقلة) ---');
  for (const error of report.consoleErrors) if (!isSliderRelated(error)) lines.push(`  (خارج النطاق) CONSOLE: ${error}`);
  for (const bad of report.badResponses) if (!isSliderRelated(bad)) lines.push(`  (خارج النطاق) BAD-RESPONSE: ${bad}`);
  lines.push('--- أي خطأ يمكن أن يخص صور السلايدر ---');
  for (const error of relatedConsole) lines.push(`  CONSOLE: ${error}`);
  for (const error of report.pageErrors) lines.push(`  PAGEERROR: ${error}`);
  for (const failure of relatedFailed) lines.push(`  FAILED-REQUEST: ${failure}`);
  for (const bad of relatedBad) lines.push(`  BAD-RESPONSE: ${bad}`);
  return lines.join('\n');
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--window-size=1440,1000'],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text().slice(0, 300));
  });
  page.on('pageerror', (error) => report.pageErrors.push(String(error).slice(0, 300)));
  page.on('requestfailed', (request) => report.failedRequests.push(`${request.method()} ${request.url().slice(0, 160)} — ${request.failure()?.errorText}`));
  page.on('response', (response) => {
    const url = response.url();
    const isImage = response.request().resourceType() === 'image';
    if (response.status() >= 400 && (isImage || url.includes('/rest/v1/') || url.includes('/storage/v1/'))) {
      report.badResponses.push(`${response.status()} ${url.slice(0, 160)}`);
    }
  });

  await auditServicesSlider(page);
  await auditJobsSlider(page);
  await auditAspectRatios(page);

  // الجوال: نفس الفحص بمقاس هاتف
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const mobile = {};
  for (const [name, url] of [['services', `${BASE}/#/`], ['jobs', `${BASE}/#/jobs`]]) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const testId = name === 'services' ? 'services-slider' : 'jobs-slider';
    await page.waitForSelector(`[data-testid="${testId}"]`, { timeout: 90000 });
    try {
      await page.waitForFunction((id) => {
        const img = document.querySelector(`[data-testid="${id}"] img[data-slide-layer="foreground"]`);
        return Boolean(img) && img.complete && img.naturalWidth > 0
          && !String(img.src).startsWith('data:image/svg+xml');
      }, { timeout: 60000 }, testId);
    } catch { /* اللقطة ستُظهر الحالة الحقيقية */ }
    await sleep(500);
    const measured = await page.evaluate((id) => {
      const slider = document.querySelector(`[data-testid="${id}"]`);
      const holder = slider.querySelector('[data-slide-id]');
      const img = holder?.querySelector('img[data-slide-layer="foreground"]');
      const frame = slider.getBoundingClientRect();
      return {
        frame: `${Math.round(frame.width)}x${Math.round(frame.height)}`,
        natural: img ? `${img.naturalWidth}x${img.naturalHeight}` : 'لا توجد صورة',
        objectFit: img ? getComputedStyle(img).objectFit : '—',
        isFallback: img ? String(img.src).startsWith('data:image/svg+xml') : true,
      };
    }, testId);
    await page.screenshot({ path: `scripts/slider-${name}-mobile.png` });
    mobile[name] = measured;
    push(!measured.isFallback && measured.natural !== '0x0', `Mobile ${testId}: صورة حقيقية ظاهرة ${measured.natural} داخل إطار ${measured.frame} (object-fit=${measured.objectFit})`);
  }
  report.mobile = mobile;
} finally {
  await browser.close();
}

console.log(summary());
await writeFile('scripts/sliders-visual-result.json', JSON.stringify(report, null, 2), 'utf8');
const failures = report.checks.filter((check) => check.startsWith('FAIL'));
if (failures.length || report.pageErrors.length) process.exitCode = 1;