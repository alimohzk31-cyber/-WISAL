// اختبار طرف-إلى-طرف حقيقي (Chrome عبر puppeteer-core) ضد خادم التطوير.
// المسار الإلزامي: SocialFeed → معاينة الخدمة → تفاصيل → عداد الزيارات → رجوع → القسم → نفس الخدمة.
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const SERVICE_ID = process.argv[2] || '76';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-first-run', '--disable-extensions'],
});
const page = await browser.newPage();
page.setDefaultTimeout(30000);
const logs = [];
page.on('console', m => logs.push(`[console:${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

const log = (...a) => console.log(...a);
const fail = msg => { log('❌ FAIL:', msg); process.exitCode = 1; };
const ok = msg => log('✅', msg);

try {
  // ---------- المرحلة 1: فتح التفاصيل مباشرة وقراءة عداد الزيارات ----------
  await page.goto(`${BASE}/#/service/${SERVICE_ID}`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 20000 });
  await sleep(2500); // مهلة كافية لوصول رد RPC

  const detailName = await page.$eval('[role="dialog"] h2, [role="dialog"] h1', el => el.textContent.trim()).catch(() => null);
  const visitsText = await page.$eval('[aria-label="عدد زيارات الخدمة"]', el => el.textContent.trim()).catch(() => null);
  log('— اسم الخدمة في التفاصيل:', detailName);
  log('— نص عداد الزيارات (قبل):', visitsText);
  if (!visitsText) fail('فقرة عداد الزيارات غير مرسومة في مكون التفاصيل!');
  else if (/غير متاح/.test(visitsText)) fail('العداد يعرض «غير متاح» بدل القيمة!');
  else if (!/👁/.test(visitsText)) fail('أيقونة العين غير ظاهرة!');
  else ok(`العداد ظاهر بصرياً: ${visitsText}`);

  const before = parseInt((visitsText || '').replace(/[^\d]/g, ''), 10);

  // ---------- المرحلة 2: Refresh لتفاصيل الخدمة — العداد يجب أن يزيد +1 ----------
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 20000 });
  await sleep(2500);
  const visitsText2 = await page.$eval('[aria-label="عدد زيارات الخدمة"]', el => el.textContent.trim()).catch(() => null);
  const after = parseInt((visitsText2 || '').replace(/[^\d]/g, ''), 10);
  log('— نص العداد (بعد Refresh):', visitsText2);
  if (Number.isFinite(before) && Number.isFinite(after)) {
    if (after === before + 1) ok(`العداد زاد +1 بعد Refresh: ${before} → ${after}`);
    else fail(`العداد لم يزد +1: قبل=${before} بعد=${after}`);
  } else fail('تعذر قراءة قيمة عددية من العداد');

  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle2' });
  await sleep(6000);
  const dbg = await page.evaluate(() => ({ hash: location.hash, articles: document.querySelectorAll('article').length, text: document.body.innerText.slice(0, 200) }));
  log(String.raw`— تشخيص الرئيسية:`, JSON.stringify(dbg));
  await page.waitForSelector('article', { timeout: 30000 });
  await sleep(1500);
  const cardFound = await page.evaluate((name) => {
    const cards = Array.from(document.querySelectorAll('article'));
    const card = cards.find(c => name && c.textContent.includes(name));
    if (!card) return false;
    const btn = Array.from(card.querySelectorAll('button')).find(b => b.textContent.includes('معاينة الخدمة'));
    if (!btn) return false;
    btn.click();
    return true;
  }, detailName);
  if (!cardFound) fail('لم يتم العثور على بطاقة الخدمة في التصفح الاجتماعي');
  else ok('تم فتح الخدمة من بطاقة SocialFeed عبر «معاينة الخدمة»');

  await page.waitForFunction(sid => location.hash.includes(`/service/${sid}`), {}, SERVICE_ID);
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 20000 });
  await sleep(2000);
  const detailName2 = await page.$eval('[role="dialog"] h2, [role="dialog"] h1', el => el.textContent.trim()).catch(() => null);
  log('— العنوان بعد المعاينة:', detailName2, '| URL:', await page.evaluate(() => location.hash));
  if (detailName && detailName2 && detailName !== detailName2) fail(`التفاصيل ليست نفس الخدمة: ${detailName} <> ${detailName2}`);
  else ok('تفاصيل نفس الخدمة ظهرت من المعاينة');

  // ---------- المرحلة 4: الرجوع إلى قسم الخدمة ----------
  let backOk = false;
  for (let attempt = 0; attempt < 5 && !backOk; attempt++) {
    backOk = await page.evaluate(() => {
      const btn = document.querySelector('[aria-label="الرجوع إلى القسم"]');
      if (!btn) return false;
      btn.click();
      return true;
    }).catch(() => page.evaluate(() => {
      const btn = document.querySelector('[aria-label="الرجوع إلى القسم"]');
      if (!btn) return false;
      btn.click();
      return true;
    }));
    if (!backOk) await sleep(1000);
  }
  await sleep(1500);
  const hash = await page.evaluate(() => location.hash);
  const heading = await page.$eval('h1', el => el.textContent.trim()).catch(() => null);
  log('— بعد الرجوع: URL=', hash, '| عنوان القسم:', heading);
  if (!hash.includes('/category/')) fail('الرجوع لم يفتح صفحة قسم!');
  else ok('الرجوع فتح صفحة القسم: ' + hash);

  // ---------- المرحلة 5: هل الخدمة نفسها موجودة داخل القسم؟ ----------
  await page.waitForSelector('.grid', { timeout: 20000 });
  await sleep(1500);
  const targetName = detailName2 || detailName;
  const inSection = await page.evaluate(name => {
    const grid = document.querySelector('.grid');
    return grid ? grid.textContent.includes(name) : false;
  }, targetName);
  const emptyState = await page.evaluate(() =>
    document.body.textContent.includes('لا توجد خدمات') || document.body.textContent.includes('كن أول'));
  log('— الخدمة ظاهرة داخل شبكة القسم؟', inSection, '| حالة لا خدمات؟', emptyState);
  if (inSection) ok(`نفس الخدمة (${targetName}) موجودة داخل قسمها`);
  else fail('القسم لا يحتوي الخدمة' + (emptyState ? ' والقسم فارغ تماماً!' : '!'));

  // ---------- المرحلة 6: فتح الخدمة من القسم والتأكد أنها نفس البيانات ----------
  const opened = await page.evaluate(name => {
    const grid = document.querySelector('.grid');
    if (!grid) return false;
    const card = Array.from(grid.children).find(c => c.textContent.includes(name));
    if (!card) return false;
    card.click();
    return true;
  }, targetName);
  if (!opened) fail('تعذر فتح الخدمة من القسم');
  await sleep(1500);
  const hash2 = await page.evaluate(() => location.hash);
  const detailName3 = await page.$eval('[role="dialog"] h2, [role="dialog"] h1', el => el.textContent.trim()).catch(() => null);
  const visitsText3 = await page.$eval('[aria-label="عدد زيارات الخدمة"]', el => el.textContent.trim()).catch(() => null);
  log('— بعد الفتح من القسم: URL=', hash2, '| العنوان:', detailName3, '| العداد:', visitsText3);
  if (detailName3 === targetName && hash2.includes(`/service/${SERVICE_ID}`)) ok('الخدمة فتحت من القسم وهي نفس البيانات ونفس service.id في الرابط');
  else fail('البيانات المفتوحة من القسم ليست نفس الخدمة!');
} finally {
  if (process.env.SHOW_CONSOLE) logs.forEach(l => log(l));
  await browser.close();
}
