// E2E نهائي: إثبات ظهور قسمي تأجير السيارات والكرينات + صفحاتهما + النموذج + المسار الكامل.
import puppeteer from 'puppeteer-core';
const base = process.argv[2] || 'http://localhost:3001';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: process.env.HEADFUL === 'true',
  args: ['--no-first-run', '--disable-web-security', '--window-size=1280,900'],
});
const results = {};
const page = await browser.newPage();
page.setDefaultTimeout(45000);
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
const reqs = [];
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const j = b => ({ status: 200, contentType: 'application/json', body: JSON.stringify(b), headers: CORS });
const categoriesDb = [
  { id: 901, slug: 'car-rentals', name_ar: 'تأجير سيارات', name_en: 'Car Rentals', icon: 'CarFront', color: 'blue', parent_id: null },
  { id: 902, slug: 'crane-rentals', name_ar: 'تأجير كرينات', name_en: 'Crane Rentals', icon: 'Forklift', color: 'orange', parent_id: null },
];
const row = (id, cat, status) => ({ id, slug: `rental-${id}`, name: `مكتب اختبار ${cat}`, category_id: cat, category_slug: cat, categorySlug: cat, status, profession: cat, location: 'حي السلام', governorate: 'النجف', image: '', images: [], created_at: new Date().toISOString(), reviewed_at: new Date().toISOString(), views: 0, experience: 'اختبار' });
let servicesRows = [];
await page.setRequestInterception(true);
page.on('request', req => {
  const url = new URL(req.url());
  if (url.origin === new URL(base).origin || ['data:', 'blob:'].includes(url.protocol)) return req.continue();
  if (!url.hostname.endsWith('supabase.co')) return req.respond({ status: 200, contentType: 'text/plain', body: '', headers: CORS });
  if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: CORS });
  const t = url.pathname.split('/').at(-1);
  reqs.push(t);
  if (t === 'categories') return req.respond(j([...categoriesDb, { id: 1, slug: 'pharmacies', name_ar: 'صيدليات', icon: 'Pill', color: 'red', parent_id: null }, { id: 2, slug: 'cars', name_ar: 'السيارات', icon: 'Car', color: 'blue', parent_id: null }, { id: 3, slug: 'construction', name_ar: 'البناء والإنشاءات', icon: 'HardHat', color: 'orange', parent_id: null }]));
  if (t === 'services') { if (req.method() === 'POST') { servicesRows = [row(501, 'car-rentals', 'pending')]; return req.respond({ status: 201, contentType: 'application/json', body: JSON.stringify(servicesRows[0]), headers: CORS }); } return req.respond(j(servicesRows)); }
  if (t === 'slider_images' || t === 'admin_notifications' || t === 'service_reactions' || t === 'service_comments') return req.respond(j([]));
  if (t === 'stats') return req.respond(j([{ id: 1, visits: 1, downloads: 0 }]));
  if (t === 'increment_visits' || t === 'increment_service_views') return req.respond(j(1));
  if (t === 'increment_service_reactions' || t === 'is_admin' || t === 'get_service_stats') return req.respond(j(0));
  return req.respond(j([]));
});
try {
  await page.goto(base + '/', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => document.querySelectorAll('article, section').length > 0, { timeout: 45000 });
    await sleep(1500);

  results.sectionsHome = await page.evaluate(() => {
    const t = document.body.innerText;
    return { carRentals: t.includes('تأجير سيارات'), craneRentals: t.includes('تأجير كرينات') };
  });

  // فتح النموذج من الوفرة المنزلية وتوثيق خيارات القسم
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').includes('إضافة خدمة'))?.click();
  });
  await page.waitForFunction(() => !!document.querySelector('[role="dialog"]'), { timeout: 25000 });
  await sleep(1200);
  results.modalOpts = await page.evaluate(() => {
    const sel = document.getElementById('service-category');
    return { exists: !!sel, values: sel ? [...sel.options].map(o => o.value).filter(Boolean) : [] };
  });
  await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (d) [...d.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').includes('إغلاق'))?.click();
  });
  await sleep(600);

  // تبويب «الخدمات» (شبكة الأقساط)
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'الخدمات')?.click();
  });
  await sleep(1500);
  results.sectionsGrid = await page.evaluate(() => {
    const t = document.body.innerText;
    return { carRentals: t.includes('تأجير سيارات'), craneRentals: t.includes('تأجير كرينات') };
  });

  // صفحات التصنيف المستقلة (مسار مستقل — لا فرع)
  await page.evaluate(() => { location.hash = '#/category/car-rentals'; });
  await sleep(1800);
  results.carRentalsPage = await page.evaluate(() => ({ hash: location.hash, title: document.body.innerText.includes('تأجير سيارات'), notUnderCars: !location.hash.includes('/category/cars') }));
  await page.evaluate(() => { location.hash = '#/category/crane-rentals'; });
  await sleep(1800);
  results.craneRentalsPage = await page.evaluate(() => ({ hash: location.hash, title: document.body.innerText.includes('تأجير كرينات') }));
    await page.evaluate(() => { location.hash = '#/'; });
  await sleep(1200);

  // ---- مسار: إضافة خدمة → مراجعة → موافقة → ظهور داخل القسم ----
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').includes('إضافة خدمة'))?.click();
  });
  await page.waitForFunction(() => !!document.querySelector('[role="dialog"]'), { timeout: 25000 });
  await sleep(1200);
  await page.select('#service-category', 'car-rentals');
  await sleep(400);
  await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return;
    for (const i of d.querySelectorAll('input[type="text"], input:not([type]), textarea')) {
      if (!i.value) {
        const p = i.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(p, 'value')?.set.call(i, 'مكتب اختبار تأجير سيارات');
        i.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    for (const s of d.querySelectorAll('select')) {
      if (!s.value) { const o = [...s.options].find(x => x.value) || [...s.options].find(x => x.textContent?.includes('النجف')); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); } }
    }
  });
  await sleep(600);
  await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return;
    const btn = [...d.querySelectorAll('button, [type=submit]')].find(b => /إضافة|نشر|إرسال|حفظ|تأكيد/.test(b.textContent || ''));
    btn?.click();
  });
  await sleep(3500);
  results.postedCategory = await page.evaluate(() => new URLSearchParams(typeof new URL(location.href).hash.replace(/^#/, '')).get('view') ?? '');
  await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (d) [...d.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || '').includes('إغلاق'))?.click();
  });
  await sleep(500);

    // التصفح: الخدمة «قيد المراجعة» — ملاحظة: الخدمات المعلقة (pending)
  // لا تظهر في تغذية التصفح العامة (تظهر بعد الموافقة فقط).
  await page.evaluate(() => { location.hash = '#/?view=browse'; });
  await sleep(3000);
  results.browsePending = await page.evaluate(() => {
    const t = document.body.innerText;
    return { found: t.includes('مكتب اختبار'), pending: t.includes('قيد المراجعة') || t.includes('بانتظار') };
  });

  servicesRows = servicesRows.map(r => ({ ...r, status: 'approved' }));
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2500);
  results.browseApproved = await page.evaluate(() => {
    const t = document.body.innerText;
    const found = [...document.querySelectorAll('article')].some(a => a.textContent?.includes('مكتب اختبار')) || t.includes('مكتب اختبار');
    return { found, pendingGone: !t.includes('قيد المراجعة') };
  });

  await page.evaluate(() => { location.hash = '#/category/car-rentals'; });
  await sleep(2500);
  results.sectionPage = await page.evaluate(() => {
    const t = document.body.innerText;
    return { hash: location.hash, sectionTitle: t.includes('تأجير سيارات'), serviceInside: t.includes('مكتب اختبار'), notUnderCars: !location.hash.includes('/category/cars') };
  });

  const pass =
    results.sectionsGrid.carRentals && results.sectionsGrid.craneRentals &&
    results.modalOpts.values.includes('car-rentals') && results.modalOpts.values.includes('crane-rentals') &&
    results.carRentalsPage.title && results.carRentalsPage.notUnderCars &&
    results.craneRentalsPage.title &&
    results.browseApproved?.found &&
    results.sectionPage?.serviceInside && results.sectionPage?.notUnderCars &&
    errors.length === 0;

  console.log(JSON.stringify({ sectionsHome: results.sectionsHome, sectionsGrid: results.sectionsGrid, modalOpts: results.modalOpts, pages: { carRentals: results.carRentalsPage, craneRentals: results.craneRentalsPage }, browse: { pending: results.browsePending, approved: results.browseApproved, section: results.sectionPage }, pageErrors: errors, supabaseCalls: reqs.slice(0, 15) }, null, 2));
  console.log('FINAL:', pass ? 'PASS' : 'FAIL');
} catch (e) {
  console.error('E2E ERROR:', String(e).slice(0, 300));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}


