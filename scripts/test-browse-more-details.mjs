// ---------------------------------------------------------------------------
// اختبار حقيقي لزر «المزيد» في واجهة التصفح — تطبيق وصال.
// ---------------------------------------------------------------------------
// لا يكفي tsc ولا build: هذا الاختبار يفتح Chrome حقيقي (puppeteer-core) على
// خادم التطوير، يقرأ البيانات الحقيقية من Supabase (Ground truth) لخدمات
// معتمدة، ثم يضغط «المزيد» داخل نفس البطاقة ويتحقق أن:
//   1) التفاصيل انفتحت داخل نفس <article> (بدون انتقال لأي صفحة أخرى).
//   2) tel: يطابق هاتف نفس الخدمة، wa.me يطابق واتساب نفس الخدمة،
//      ورابط الخرائط يطابق عنوان/إحداثيات نفس الخدمة.
//   3) الكلمة تغيّرت إلى «إخفاء التفاصيل» والضغط مرة أخرى يغلقها.
//   4) لا تظهر أزرار لحقول فارغة (خدمة بلا واتساب لا يظهر لها زر واتساب).
//   5) لا إعادة تحميل ولا تغيّر في المسار عند الضغط (موضع المستخدم محفوظ).
//   6) زمن فتح التفاصيل ≤ 1000ms (فتح فوري بلا Lag).
//
// التشغيل: node scripts/test-browse-more-details.mjs [http://127.0.0.1:3000]
// متغيرات: WISAL_UI_BASE — CHROME_PATH — SUPABASE_ANON_KEY
// ---------------------------------------------------------------------------
import puppeteer from 'puppeteer-core';
import { writeFile, mkdir } from 'node:fs/promises';

const BASE = process.argv[2] || process.env.WISAL_UI_BASE || 'http://127.0.0.1:3000';
const SUPABASE_URL = 'https://nnxrjpitjxtceydlcxzm.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueHJqcGl0anh0Y2V5ZGxjeHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDkyMjMsImV4cCI6MjA5MTIyNTIyM30.Ui1IQ4OOJ8wngBoNIBNe0nTCQgfm0q8P7AjrKhyAU4w';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [];
const push = (pass, message) => { checks.push(`${pass ? 'PASS' : 'FAIL'}: ${message}`); };
const digits = (v) => String(v ?? '').replace(/[^0-9]/g, '');

const coreColumns = 'id,title,description,phone,address,latitude,longitude,status';
const socialColumns = 'id,whatsapp_phone,facebook_url,instagram_url,tiktok_url';

async function fetchApprovedServices() {
  const get = async (select) => {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/services?select=${select}&status=eq.approved&order=reviewed_at.desc.nullslast,created_at.desc,id.desc&limit=60`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
    );
    if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
    return await res.json();
  };
  const rows = await get(coreColumns);
  // أعمدة التواصل اختيارية: قد لا تكون الهجرة supabase_add_service_social_contacts.sql
  // قد شُغّلت على المشروع. عند غيابها نكمل الاختبار بالحقول الأساسية فقط.
  try {
    const social = await get(socialColumns);
    const byId = new Map(social.map((r) => [r.id, r]));
    for (const row of rows) Object.assign(row, byId.get(row.id) ?? {});
  } catch {
    console.warn('[ground-truth] أعمدة التواصل (واتساب/فيسبوك/انستغرام/تيك توك) غير موجودة في القاعدة — تُتجاهل فحوصاتها');
  }
  return rows;
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--window-size=1280,1000'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1000 });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

const report = { base: BASE, services: [], errors: pageErrors };

// قراءة داخل نفس البطاقة فقط — جوهر الاختبار: الأزرار تحمل بيانات نفس الخدمة.
const readCard = (title) => page.evaluate((t) => {
  const art = [...document.querySelectorAll('article')].find((a) => (a.textContent || '').includes(t));
  if (!art) return { found: false };
  const links = [...art.querySelectorAll('a')].map((a) => a.getAttribute('href') || '');
  const buttons = [...art.querySelectorAll('button')].map((b) => (b.textContent || '').trim());
  return {
    found: true,
    expanded: buttons.some((b) => b.includes('إخفاء التفاصيل')) || buttons.includes('أقل'),
    tel: links.filter((h) => h.startsWith('tel:')),
    wa: links.filter((h) => h.startsWith('https://wa.me/')),
    maps: links.filter((h) => h.includes('google.com/maps')),
    waze: links.filter((h) => h.includes('waze.com')),
    facebook: links.filter((h) => h.includes('facebook.com')),
    instagram: links.filter((h) => h.includes('instagram.com')),
    tiktok: links.filter((h) => h.includes('tiktok.com')),
    hasDetailsSection: (art.textContent || '').includes('النبذة كاملة'),
    text: art.textContent || '',
    articlesOnPage: document.querySelectorAll('article').length,
    hash: location.hash,
  };
}, title);

const clickMore = (title) => page.evaluate((t) => {
  const art = [...document.querySelectorAll('article')].find((a) => (a.textContent || '').includes(t));
  if (!art) return 'no-article';
  const buttons = [...art.querySelectorAll('button')];
  const more = buttons.find((b) => (b.textContent || '').trim() === 'المزيد');
  if (!more) {
    return buttons.some((b) => (b.textContent || '').includes('إخفاء التفاصيل')) ? 'already-expanded' : 'no-more-button';
  }
  more.click();
  return 'clicked';
}, title);

const clickHide = (title) => page.evaluate((t) => {
  const art = [...document.querySelectorAll('article')].find((a) => (a.textContent || '').includes(t));
  if (!art) return 'no-article';
  const buttons = [...art.querySelectorAll('button')];
  const hide = buttons.find((b) => (b.textContent || '').trim().includes('إخفاء التفاصيل'))
    || buttons.find((b) => (b.textContent || '').trim() === 'أقل');
  if (!hide) return 'no-hide-button';
  hide.click();
  return 'clicked';
}, title);

const waitExpanded = (title) => page.waitForFunction((t) => {
  const art = [...document.querySelectorAll('article')].find((a) => (a.textContent || '').includes(t));
  return !!art && [...art.querySelectorAll('button')].some((b) => (b.textContent || '').trim().includes('إخفاء التفاصيل'));
}, { timeout: 5000 }, title);

const waitCollapsed = (title) => page.waitForFunction((t) => {
  const art = [...document.querySelectorAll('article')].find((a) => (a.textContent || '').includes(t));
  return !!art && ![...art.querySelectorAll('button')].some((b) => (b.textContent || '').trim().includes('إخفاء التفاصيل'));
}, { timeout: 4000 }, title);


try {
  // 1) Ground truth من قاعدة البيانات
  const rows = await fetchApprovedServices();
  console.log(`[ground-truth] خدمات معتمدة مقروءة من Supabase: ${rows.length}`);

  // 2) فتح التطبيق والانتقال إلى واجهة التصفح
  await page.goto(BASE + '/#/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => document.querySelectorAll('article').length > 0
    || [...document.querySelectorAll('button')].some((b) => (b.textContent || '').trim() === 'التصفح'),
  { timeout: 120000 });

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'التصفح');
    if (btn) btn.click();
  });
  await page.waitForFunction(() => document.querySelectorAll('article').length > 0, { timeout: 120000 });
  await sleep(1500);

  // علامة لكشف أي إعادة تحميل للصفحة عند الضغط على «المزيد»
  const reloadMark = `mark_${Date.now()}`;
  await page.evaluate((m) => { window.__wisalReloadMark = m; }, reloadMark);

  const renderedTitles = await page.evaluate(() => [...document.querySelectorAll('article')]
    .map((a) => (a.querySelector('h2, h3, h4')?.textContent || '').trim())
    .filter(Boolean));
  console.log(`[DOM] بطاقات معروضة في التصفح: ${renderedTitles.length}`);

  // 3) ربط بطاقات DOM بصفوف قاعدة البيانات — بالعنوان، وبخدمة واحدة فقط لكل عنوان
  const titleCounts = new Map();
  for (const row of rows) {
    const t = String(row.title || '').trim();
    titleCounts.set(t, (titleCounts.get(t) || 0) + 1);
  }
  const candidates = [];
  for (const title of renderedTitles) {
    if (titleCounts.get(title) !== 1) continue; // عنوان مكرر: لا يمكن نسب البيانات لصف واحد بيقين
    const row = rows.find((r) => String(r.title || '').trim() === title);
    if (row) candidates.push({ title, row });
  }

  const withPhone = candidates.filter((c) => digits(c.row.phone).length >= 6);
  const withWhatsapp = candidates.filter((c) => digits(c.row.whatsapp_phone).length >= 6);
  const withAddress = candidates.filter((c) => String(c.row.address || '').trim() !== ''
    || (c.row.latitude !== null && c.row.longitude !== null));
  const withSocial = candidates.filter((c) => c.row.facebook_url || c.row.instagram_url || c.row.tiktok_url);

  console.log(`[تغطية] هاتف=${withPhone.length} واتساب=${withWhatsapp.length} عنوان/موقع=${withAddress.length} وسائل تواصل=${withSocial.length}`);

  const primary = withPhone.find((c) => withAddress.includes(c) && withWhatsapp.includes(c))
    || withPhone.find((c) => withAddress.includes(c))
    || withPhone[0];

  if (!primary) {
    push(false, 'لم تُعرض أي خدمة معتمدة تحتوي هاتفاً في واجهة التصفح — لا يمكن التحقق');
  }

  const rowsToTest = [];
  if (primary) rowsToTest.push(primary);
  // خدمة إضافية بلا واتساب للتأكد من عدم ظهور زر واتساب لحقل فارغ
  const withoutWhatsapp = candidates.find((c) => !withWhatsapp.includes(c) && c !== primary);
  if (withoutWhatsapp) rowsToTest.push(withoutWhatsapp);
  // خدمة إضافية بوسائل تواصل اجتماعي
  const socialOne = withSocial.find((c) => !rowsToTest.includes(c));
  if (socialOne) rowsToTest.push(socialOne);
  // خدمة تحتوي إحداثيات لاختبار زر ويز
  const withCoords = withAddress.find((c) => c.row.latitude !== null && c.row.longitude !== null && !rowsToTest.includes(c));
  if (withCoords) rowsToTest.push(withCoords);

  console.log(`[تحديد] خدمات تحت الاختبار: ${rowsToTest.map((c) => c.title).join(' | ')}`);


  // 4) الاختبار الفعلي: الضغط على «المزيد» داخل نفس البطاقة
  for (const candidate of rowsToTest) {
    const { title, row } = candidate;
    const before = await readCard(title);
    const serviceLabel = row.title;
    if (!before.found) {
      push(false, `البطاقة "${serviceLabel}" غير موجودة في DOM قبل التوسيع`);
      continue;
    }

    const clicked = await clickMore(title);
    if (clicked !== 'clicked') {
      push(false, `زر «المزيد» للخدمة "${serviceLabel}": ${clicked}`);
      continue;
    }

    // قياس زمن الفتح الفعلي (المطلوب: سريع وبدون Lag)
    const openStart = Date.now();
    let opened = true;
    try {
      await waitExpanded(title);
    } catch {
      opened = false;
    }
    const openMs = Date.now() - openStart;

    const after = await readCard(title);

    push(opened && after.expanded, `«المزيد» وسّع بطاقة "${serviceLabel}" في مكانها (${openMs}ms)`);
    push(openMs <= 1000, `زمن فتح التفاصيل للخدمة "${serviceLabel}": ${openMs}ms (المطلوب ≤1000ms)`);

    // 1) لا انتقال ولا إعادة تحميل ولا إعادة جلب
    const sameHash = after.hash === before.hash;
    const markKept = await page.evaluate((m) => window.__wisalReloadMark === m, reloadMark);
    const sameArticleCount = after.articlesOnPage === before.articlesOnPage;
    push(sameHash, `الخدمة "${serviceLabel}": لم يتغيّر المسار بعد الضغط (${before.hash} → ${after.hash})`);
    push(markKept, `الخدمة "${serviceLabel}": لم تُعدَّ الصفحة ولم يُعد جلب الخدمات (علامة الجلسة محفوظة)`);
    push(sameArticleCount, `الخدمة "${serviceLabel}": عدد بطاقات التصفح ثابت (${before.articlesOnPage} → ${after.articlesOnPage})`);

    // 2) الوصف الكامل ظهر
    const fullDescription = String(row.description || '').trim();
    if (fullDescription) {
      const normalizedArt = after.text.replace(/\s+/g, ' ');
      const snippet = fullDescription.replace(/\s+/g, ' ').slice(0, 60);
      push(normalizedArt.includes(snippet), `الخدمة "${serviceLabel}": الوصف الكامل معروض بعد التوسيع`);
    }
    push(after.hasDetailsSection, `الخدمة "${serviceLabel}": قسم «النبذة كاملة» ظاهر`);

    // 3) الهاتف: tel: يطابق هاتف نفس الخدمة
    const rowPhone = digits(row.phone);
    if (rowPhone) {
      const telMatch = after.tel.some((h) => digits(h) === rowPhone);
      push(telMatch, `الخدمة "${serviceLabel}": زر الاتصال يحمل هاتف نفس الخدمة (${rowPhone}) — الروابط: ${JSON.stringify(after.tel)}`);
    }

    // 4) واتساب: يظهر فقط عند وجود قيمة، ويطابق نفس الخدمة
    const rowWhats = digits(row.whatsapp_phone);
    if (rowWhats) {
      const waMatch = after.wa.some((h) => digits(h) === rowWhats);
      push(waMatch, `الخدمة "${serviceLabel}": زر واتساب يطابق واتساب نفس الخدمة (${rowWhats}) — الروابط: ${JSON.stringify(after.wa)}`);
    } else {
      push(after.wa.length === 0, `الخدمة "${serviceLabel}": لا واتساب في القاعدة ⇒ لا يظهر زر واتساب (وجد ${after.wa.length})`);
    }

    // 5) الموقع/الخريطة يطابق عنوان أو إحداثيات نفس الخدمة
    const rowAddress = String(row.address || '').trim();
    const hasCoords = row.latitude !== null && row.longitude !== null;
    if (hasCoords) {
      const mapsOk = after.maps.some((h) => h.includes(String(row.latitude)) && h.includes(String(row.longitude)));
      push(mapsOk, `الخدمة "${serviceLabel}": رابط الخرائط يحمل إحداثيات نفس الخدمة (${row.latitude}, ${row.longitude}) — الروابط: ${JSON.stringify(after.maps)}`);
      push(after.waze.length > 0, `الخدمة "${serviceLabel}": رابط ويز متاح بنفس الإحداثيات`);
    } else if (rowAddress) {
      const mapsOk = after.maps.some((h) => h.includes(encodeURIComponent(rowAddress)));
      push(mapsOk, `الخدمة "${serviceLabel}": رابط الخرائط يحمل عنوان نفس الخدمة (${rowAddress}) — الروابط: ${JSON.stringify(after.maps)}`);
    } else {
      push(after.maps.length === 0, `الخدمة "${serviceLabel}": لا عنوان ولا إحداثيات ⇒ لا يظهر زر خرائط`);
    }

    // 6) وسائل التواصل: كل رابط يطابق نفس الخدمة، والفارغ لا يظهر
    const rowFb = String(row.facebook_url || '').trim();
    const rowIg = String(row.instagram_url || '').trim();
    const rowTt = String(row.tiktok_url || '').trim();
    const sameOrigin = (shown, stored) => shown.some((h) => h.replace(/\/+$/, '') === stored.replace(/\/+$/, ''));
    if (rowFb) push(sameOrigin(after.facebook, rowFb), `الخدمة "${serviceLabel}": رابط فيسبوك مطابق لفيسبوك نفس الخدمة`);
    if (rowIg) push(sameOrigin(after.instagram, rowIg), `الخدمة "${serviceLabel}": رابط انستغرام مطابق لانستغرام نفس الخدمة`);
    if (rowTt) push(sameOrigin(after.tiktok, rowTt), `الخدمة "${serviceLabel}": رابط تيك توك مطابق لتيك توك نفس الخدمة`);
    if (!rowFb) push(after.facebook.length === 0, `الخدمة "${serviceLabel}": لا فيسبوك في القاعدة ⇒ لا يظهر زره`);
    if (!rowIg) push(after.instagram.length === 0, `الخدمة "${serviceLabel}": لا انستغرام في القاعدة ⇒ لا يظهر زره`);

    // 7) الإغلاق: «إخفاء التفاصيل»/«أقل» يرجع البطاقة لحجمها المختصر
    const hidden = await clickHide(title);
    try {
      await waitCollapsed(title);
    } catch { /* نُبقي النتيجة كما هي */ }
    const closed = await readCard(title);
    push(hidden === 'clicked' && !closed.expanded && closed.tel.length === 0 && !closed.hasDetailsSection,
      `الخدمة "${serviceLabel}": الضغط على «إخفاء التفاصيل» أغلق التفاصيل وأعاد البطاقة لحجمها (${hidden})`);

    report.services.push({
      title: serviceLabel,
      openMs,
      row: {
        id: row.id,
        phone: row.phone,
        whatsapp: row.whatsapp_phone,
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        facebook: row.facebook_url,
        instagram: row.instagram_url,
      },
      expandedLinks: { tel: after.tel, wa: after.wa, maps: after.maps },
    });
  }

  report.renderedCards = renderedTitles.length;
  report.checks = checks;

  await mkdir('tmp', { recursive: true });
  await writeFile('tmp/browse-more-details-report.json', JSON.stringify(report, null, 2), 'utf8');

  console.log('\n=== تقرير اختبار زر «المزيد» في التصفح (وصال) ===');
  for (const line of checks) console.log(line);
  console.log(`أخطاء صفحة (pageerror): ${pageErrors.length}`);
  pageErrors.slice(0, 5).forEach((e) => console.log(`  [pageerror] ${e}`));

  const failed = checks.filter((c) => c.startsWith('FAIL'));
  console.log(`\nالنتيجة: ${failed.length === 0 ? 'النجاح ✅' : `فشل ❌ (${failed.length} فحص)`}`);
  process.exit(failed.length === 0 && pageErrors.length === 0 ? 0 : 1);
} finally {
  await browser.close();
}
