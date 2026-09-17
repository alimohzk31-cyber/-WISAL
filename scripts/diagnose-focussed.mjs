// تشخيص مركّز: الإصدار 1.1 + أيقونة القسم + البحث عن النصوص في DOM الحي.
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] || 'http://127.0.0.1:3000';
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-first-run'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 }); // هاتف محمول يفتح القوائم
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('[console.error] ' + m.text().slice(0, 500)); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e).slice(0, 1200)));

await page.goto(BASE + '/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => document.querySelectorAll('article').length > 0, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));

const domText = (sel) => page.evaluate((s) => (document.querySelector(s)?.textContent || '').trim(), sel);
const hasText = async (needle) => await page.evaluate((n) => (document.body.textContent || '').includes(n), needle);

console.log('--- زر الإصدار في Layout ---');
const versionButtonInfo = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button, a')].filter((b) => /1\.1|إصدار|الإصدار|version/i.test(b.textContent || ''));
  return btns.map((b) => ({
    tag: b.tagName, text: (b.textContent || '').trim().slice(0, 60),
    ariaLabel: b.getAttribute('aria-label'), onclick: b.getAttribute('onclick'),
    onclickAttr: b.getAttribute('onclick'),
    dataAttrs: [...b.attributes].filter((a) => a.name.startsWith('data-')).map((a) => `${a.name}="${a.value}"`).join(' '),
    closestMenu: b.closest('[class*="menu"],[class*="Menu"],[class*="popup"],[class*="drawer"]') ? 'inside-menu' : 'no-close',
  }));
});
console.log(JSON.stringify(versionButtonInfo, null, 2));
if (versionButtonInfo.length) {
  await versionButtonInfo[0].click?.();
  await new Promise((r) => setTimeout(r, 3500));
  const afterVersion = {
    hash: await domText('html'),
    hashRaw: await page.evaluate(() => location.hash),
    modalVisible: await hasText('إصدار تطبيق وصال'),
    bodySnippet: await page.evaluate((n) => (document.body.textContent || '').replace(/\s+/g, ' ').slice(0, 350), null),
    showAppVersionState: await page.evaluate(() => window.__wisal && window.__wisal.showAppVersion),
  };
  console.log('بعد الضغط على زر الإصدار:\n' + JSON.stringify(afterVersion, null, 2));
}

console.log('\n--- أيقونة القسم داخل بطاقة خدمة ---');
const categoryClickInfo = await page.evaluate(() => {
  const art = document.querySelector('article');
  const cards = art ? [art] : [...document.querySelectorAll('article')].slice(0, 1);
  const target = cards[0];
  const btn = target?.querySelector('button[aria-label*="القسم" i],.layout-grid,a[aria-label*="القسم" i]');
  return {
    hasArticle: !!target,
    btnFound: !!btn,
    btnHtml: btn ? btn.outerHTML.slice(0, 300) : null,
    targetText: target ? (target.textContent || '').replace(/\s+/g, ' ').slice(0, 120) : null,
    categoryInFeedProps: target ? (target.querySelector('[data-category]') || {}).getAttribute('data-category') : null,
  };
});
console.log(JSON.stringify(categoryClickInfo, null, 2));
// حاول النقر على أيقونة القسم whichever الطريقة
const didClickCat = await page.evaluate(() => {
  const target = document.querySelector('article');
  if (!target) return 'no-article';
  // الطريقة الأولى: زر aria-label فيه "القسم"
  const btn = target.querySelector('button[aria-label*="القسم" i]');
  if (btn) { btn.click(); return `clicked-btn`; }
  // الطريقة الثانية: أي رابط أو زر داخل البطاقة يحمل section/category
  const fallback = [...target.querySelectorAll('a, button')].find((el) => /section|category|قسم/i.test(el.textContent || '') || el.getAttribute('aria-label')?.match(/قسم/i));
  if (fallback) { fallback.click(); return 'clicked-fallback'; }
  return 'no-category-action';
});
await new Promise((r) => setTimeout(r, 3500));
const afterCategory = {
  hash: await page.evaluate(() => location.hash),
  path: await page.evaluate(() => location.pathname),
  hasCategoryPage: await hasText('القسم'),
  bodySnippet: await page.evaluate(() => (document.body.textContent || '').replace(/\s+/g, ' ').slice(0, 350)),
  articleCount: await page.evaluate(() => document.querySelectorAll('article').length),
};
console.log('بعد ضغط أيقونة القسم:\n' + JSON.stringify(afterCategory, null, 2));

console.log('\n--- البحث في DOM الكامل عن نصوص المشكلة ---');
const bodies = ['صفحة غير متوفرة', 'غير متاحة', 'غير موجود', 'القسم غير موجود', 'تعذر تشغيل وصال', 'صفحة غير'];
for (const b of bodies) {
  const found = await hasText(b);
  console.log(`DOM يحتوي "${b}": ${found}`);
}

console.log('\n--- كل أخطاء الـ console/pageerror الملتقطة ---');
errors.slice(0, 15).forEach((e) => console.log(e));
await browser.close();
