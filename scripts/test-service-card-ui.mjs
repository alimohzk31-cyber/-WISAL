// ---------------------------------------------------------------------------
// اختبار واجهة فعلي لبطاقة الخدمة — تطبيق وصال الحقيقي على خادم التطوير.
// يتحقق من الترتيب النهائي المطلوب:
//   1) الحالة المختصرة: نبذة قصيرة واحدة تنتهي بكلمة «المزيد» مرة واحدة فقط.
//   2) عند الضغط: كل التفاصيل تظهر داخل نفس البطاقة (بلا نافذة) وتنتهي بـ«عرض أقل».
//   3) أسفل البطاقة صف واحد فقط: إعجاب | تعليق | حفظ | القسم.
//   4) «القسم» بجانب «حفظ» مباشرة وينفّذ نفس وظيفة زر «الدخول إلى القسم» (يفتح القسم).
//   5) لا يوجد زر كبير «الدخول إلى القسم» أسفل البطاقة.
// Supabase مُستبدل ببيانات مصطنعة عبر اعتراض الطلبات — لا قراءة ولا كتابة حقيقية.
// التشغيل: node scripts/test-service-card-ui.mjs [http://localhost:3000]
// ---------------------------------------------------------------------------
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] || process.env.WISAL_UI_BASE || 'http://localhost:3000';
const SERVICE_ID = 77;
const DETAILS_ID = `browse-details-${SERVICE_ID}`;
const FULL_MARKER = 'نهاية الوصف الكامل للخدمة';
const CATEGORY_SLUG = 'pharmacy';
const LONG_EXPERIENCE = `${'وصف تفصيلي كامل للخدمة '.repeat(12)}${FULL_MARKER}`;

const serviceRow = {
  id: SERVICE_ID,
  slug: 'card-service-77',
  title: 'صيدلية اختبار البطاقة',
  profession: 'صيدلي',
  description: LONG_EXPERIENCE,
  address: 'بغداد - الكرادة',
  latitude: 33.31,
  longitude: 44.36,
  phone: '07700000000',
  whatsapp_phone: '07700000001',
  facebook_url: 'https://facebook.com/card-test',
  instagram_url: 'https://instagram.com/card-test',
  tiktok_url: 'https://tiktok.com/@card-test',
  image_url: 'https://images.example/hero.png',
  images: ['https://images.example/hero.png', 'https://images.example/extra-1.png', 'https://images.example/extra-2.png'],
  video_url: 'https://youtu.be/card-test',
  views: 12,
  category_id: CATEGORY_SLUG,
  category_slug: CATEGORY_SLUG,
  status: 'approved',
  created_at: '2024-01-01T00:00:00.000Z',
  reviewed_at: '2024-01-01T00:00:00.000Z',
};

const checks = [];
const errors = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const push = (pass, message) => checks.push(`${pass ? 'PASS' : 'FAIL'}: ${message}`);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  page.on('pageerror', (error) => { errors.push(String(error)); console.log(`PAGEERROR: ${error}`); });

  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const url = new URL(request.url());
    if (url.origin === new URL(BASE).origin || ['data:', 'blob:'].includes(url.protocol)) return request.continue();
    if (!url.hostname.endsWith('supabase.co')) {
      return request.respond({ status: 200, contentType: 'text/plain', body: '', headers });
    }
    if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers });
    const table = url.pathname.split('/').at(-1);
    let data = [];
    if (table === 'categories') data = [{ id: CATEGORY_SLUG, slug: CATEGORY_SLUG, name_ar: 'صيدليات', icon: 'Pill', color: 'green' }];
    if (table === 'services') data = [serviceRow];
    if (table === 'increment_visits' || table === 'increment_service_views') data = 2;
    if (table === 'is_admin') data = false;
    await request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(data), headers });
  });

  const waitForCard = (text) => page.waitForFunction(
    (marker) => [...document.querySelectorAll('article')].some((card) => (card.textContent || '').includes(marker)),
    { timeout: 60_000 },
    text,
  );

  const clickButton = (text) => page.evaluate((label) => {
    const button = [...document.querySelectorAll('article button')].find((node) => (node.textContent || '').trim() === label);
    if (!button) throw new Error(`زر «${label}» غير موجود`);
    button.click();
    return true;
  }, text);

  const cardState = () => page.evaluate((fullMarker, detailsId) => {
    const article = document.querySelector('article');
    const buttons = article ? [...article.querySelectorAll('button')] : [];
    const bar = [...article.querySelectorAll('div')]
      .find((node) => node.className.includes('flex-nowrap') && node.className.includes('border-t'));
    const rowItems = bar ? [...bar.children] : [];
    const rects = rowItems.map((node) => {
      const rect = node.getBoundingClientRect();
      return { text: (node.textContent || '').trim(), top: Math.round(rect.top), left: Math.round(rect.left), right: Math.round(rect.right) };
    });
    const details = document.getElementById(detailsId);
    return {
      more: buttons.filter((button) => (button.textContent || '').trim() === 'المزيد').length,
      less: buttons.filter((button) => (button.textContent || '').trim() === 'عرض أقل').length,
      bigEntryButton: buttons.filter((button) => (button.textContent || '').includes('الدخول إلى القسم')).length,
      categoryButtons: buttons.filter((button) => (button.textContent || '').trim() === 'القسم').length,
      fullTextVisible: (article.textContent || '').includes(fullMarker),
      detailsInsideCard: Boolean(details) && details.parentElement.tagName === 'ARTICLE',
      detailsBlocks: details ? details.children.length : 0,
      lessInsideDetails: Boolean(details) && [...details.querySelectorAll('button')].some((button) => (button.textContent || '').trim() === 'عرض أقل'),
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      labels: rects.map((rect) => rect.text).filter(Boolean),
      rects,
      barOverflow: bar ? bar.scrollWidth - bar.clientWidth : -1,
      bodyText: article.textContent || '',
    };
  }, FULL_MARKER, DETAILS_ID);

  const checkRow = (state, width) => {
    assert.deepEqual(state.labels, ['إعجاب', 'تعليق', 'حفظ', 'القسم'].map((text) => (text === 'تعليق' ? 'تعليق' : text)),
      `ترتيب الصف عند ${width}px: ${state.labels.join(' | ')}`);
    // تجاهل العناصر صفرية العرض (مثل عدّاد التفاعلات الفارغ) عند فحص التفاف الصف.
    const visibleRects = state.rects.filter((rect) => rect.right > rect.left);
    const tops = [...new Set(visibleRects.map((rect) => rect.top))];
    assert.equal(tops.length, 1, `الصف لا يلتف عند ${width}px (${visibleRects.length} عناصر مرئية)\n${JSON.stringify(state.rects, null, 1)}`);
    assert.ok(state.barOverflow <= 1, `لا تجاوز أفقي في الصف عند ${width}px (${state.barOverflow}px)`);
    const save = state.rects.find((rect) => rect.text === 'حفظ');
    const category = state.rects.find((rect) => rect.text === 'القسم');
    const gap = save.left - category.right;
    assert.ok(gap >= 0 && gap <= 24, `«القسم» ملاصق لـ«حفظ» عند ${width}px (فجوة ${gap}px)`);
    push(true, `صف واحد فقط بترتيب إعجاب | تعليق | حفظ | القسم عند ${width}px`);
  };

  // ---------- 1) الحالة المختصرة ----------
  await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await waitForCard('صيدلية اختبار البطاقة');
  await sleep(700);
  const collapsed = await cardState();
  push(collapsed.more === 1, 'الحالة المختصرة: كلمة «المزيد» تظهر مرة واحدة فقط');
  push(collapsed.less === 0, 'الحالة المختصرة: لا تظهر «عرض أقل»');
  push(!collapsed.fullTextVisible, 'الحالة المختصرة: النبذة قصيرة والتفاصيل الكاملة مخفية');
  push(collapsed.detailsBlocks === 0, 'الحالة المختصرة: لوحة التفاصيل غير موجودة');
  push(collapsed.bigEntryButton === 0, 'لا يوجد زر كبير «الدخول إلى القسم» في البطاقة');
  push(collapsed.categoryButtons === 1, 'زر «القسم» واحد فقط داخل البطاقة');
  push(collapsed.dialogs === 0, 'الضغط على البطاقة لا يفتح أي نافذة');
  checkRow(collapsed, 390);

  await page.setViewport({ width: 1280, height: 900 });
  await sleep(400);
  checkRow(await cardState(), 1280);
  await page.setViewport({ width: 390, height: 844 });
  await sleep(400);

  // ---------- 2) «المزيد» يفتح كل التفاصيل كقطعة واحدة داخل نفس البطاقة ----------
  await clickButton('المزيد');
  await page.waitForFunction((id) => {
    const panel = document.getElementById(id);
    return Boolean(panel && panel.getBoundingClientRect().height > 40);
  }, { timeout: 15_000 }, DETAILS_ID);
  await sleep(400);
  const expanded = await cardState();
  push(expanded.more === 0, 'الحالة الموسعة: لا يوجد «المزيد»');
  push(expanded.less === 1, 'الحالة الموسعة: «عرض أقل» مرة واحدة فقط');
  push(expanded.fullTextVisible, 'الحالة الموسعة: النبذة الكاملة ظاهرة داخل البطاقة');
  push(expanded.detailsInsideCard, 'التفاصيل داخل نفس البطاقة (وليست نافذة أو عنصراً خارجها)');
  push(expanded.detailsBlocks >= 2, `التفاصيل كقطعة واحدة مرتبة (${expanded.detailsBlocks} كتلة)`);
  push(expanded.lessInsideDetails, '«عرض أقل» في نهاية التفاصيل');
  push(expanded.bigEntryButton === 0, 'الحالة الموسعة: لا زر «الدخول إلى القسم» كبير');
  push(expanded.dialogs === 0, 'التوسيع لا يفتح أي نافذة');
  checkRow(expanded, 390);

  // ---------- 3) «عرض أقل» يرجع للحالة المختصرة ----------
  await clickButton('عرض أقل');
  await page.waitForFunction((id) => !document.getElementById(id), { timeout: 15_000 }, DETAILS_ID);
  await sleep(300);
  const backToCollapsed = await cardState();
  push(backToCollapsed.more === 1 && backToCollapsed.less === 0, '«عرض أقل» يعيد البطاقة للحالة المختصرة');
  push(!backToCollapsed.fullTextVisible, 'التفاصيل الكاملة مخفية بعد «عرض أقل»');

  // ---------- 4) «القسم» ينفّذ وظيفة «الدخول إلى القسم» ويفتح قسم الخدمة ----------
  console.log(checks.join('\n'));
  console.log('--- STEP4 ---');
  checks.length = 0;
  await clickButton('القسم');
  const hashSamples = [];
  for (const delay of [150, 600, 1500, 3000]) {
    await sleep(delay);
    hashSamples.push(await page.evaluate(() => window.location.hash));
  }
  console.log('HASH_SAMPLES: ' + JSON.stringify(hashSamples));
  const finalHash = hashSamples[hashSamples.length - 1] ?? '';
  const navigatedToCategory = hashSamples.some((hash) => hash.startsWith('#/category/'));
  const categoryHeading = await page.evaluate(() => (document.getElementById('root')?.textContent || '').includes('صيدليات'));
  push(navigatedToCategory, `«القسم» ينقل إلى قسم الخدمة (${JSON.stringify(hashSamples)})`);
  push(categoryHeading, 'صفحة القسم تعرض محتوى «صيدليات» فعلياً');
  if (finalHash !== '#/category/pharmacy') console.log(`FINAL_HASH=${finalHash}`);

  // ---------- النتيجة ----------
  console.log(checks.join('\n'));
  const failed = checks.filter((line) => line.startsWith('FAIL'));
  if (errors.length > 0) console.log(`PAGEERRORS: ${errors.join(' || ')}`);
  if (failed.length > 0 || errors.length > 0) {
    console.error(`فشل ${failed.length} فحصاً`);
    process.exitCode = 1;
  } else {
    console.log(`نجحت كل الفحوصات (${checks.length}/${checks.length}) ✅`);
  }
} finally {
  await browser.close();
}
