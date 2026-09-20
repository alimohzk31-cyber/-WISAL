// تشخيص حي: الإصدار 1.1، فتح القسم من بطاقة، ومسار الإدارة — مع التقاط Console والأخطاء.
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] || 'http://127.0.0.1:3000';
const userDataDir = `C:/Users/MOHAL-~1/AppData/Local/Temp/puppeteer_diag_${Date.now()}`;
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  userDataDir,
  args: ['--no-first-run'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1000 });
const errors = [];
page.on('console', (m) => {
 ؤؤؤؤؤؤؤؤؤؤؤؤؤؤؤؤؤؤؤؤؤؤؤؤؤؤؤؤؤر                                if (type === 'error' || type === 'warning') errors.push(`[console.${type}] ${m.text().slice(0, 600)}`);
});
page.on('pageerror', (e) => errors.push('[pageerror] ' + String(e).slice(0, 1500)));
page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url().slice(-90)} → ${r.failure()?.errorText}`));

const dump = (label, obj) => console.log(`\n=== ${label} ===\n` + JSON.stringify(obj, null, 2));

await page.goto(BASE + '/#/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => document.querySelectorAll('article').length > 0, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));
errors.length = 0; // تجاهل أخطاء الإقلاع العابرة

// 1) زر/رقم الإصدار 1.1
const versionInfo = await page.evaluate(() => {
  const candidates = [...document.querySelectorAll('button, a, span, p')]
    .filter((el) => /1\.1/.test(el.textContent || '') && (el.textContent || '').length < 60);
  return candidates.map((el) => ({
    tag: el.tagName, text: (el.textContent || '').trim(),
    href: el.getAttribute('href'), classes: String(el.className).slice(0, 80),
  }));
});
dump('عناصر تحتوي 1.1', versionInfo);
if (versionInfo.length) {
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button, a')].find((b) => /1\.1/.test(b.textContent || ''));
    el?.click();
  });
  await new Promise((r) => setTimeout(r, 2500));
  const modalState = await page.evaluate(() => ({
    hash: location.hash,
    h1: document.querySelector('h1')?.textContent || '',
    h2: document.querySelector('h2')?.textContent || '',
    bodySnippet: (document.body.textContent || '').replace(/\s+/g, ' ').slice(0, 250),
  }));
  dump('بعد الضغط على 1.1', modalState);
}

// 2) فتح القسم من بطاقة خدمة (أيقونة القسم / رابط القسم)
errors.length = 0;
await page.goto(BASE + '/#/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelectorAll('article').length > 0, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
const cardLinks = await page.evaluate(() => {
  const art = document.querySelector('article');
  if (!art) return [];
  return [...art.querySelectorAll('a, button')].map((el) => ({
    tag: el.tagName, text: (el.textContent || '').trim().slice(0, 40), href: el.getAttribute('href'),
  }));
});
dump('روابط أول بطاقة', cardLinks);
const clickedCategory = await page.evaluate(() => {
  const art = document.querySelector('article');
  const link = art?.querySelector('a[href*="/category/"]');
  if (link) { link.click(); return link.getAttribute('href'); }
  return null;
});
dump('رابط القسم المضغوط', { clickedCategory });
await new Promise((r) => setTimeout(r, 3000));
const categoryState = await page.evaluate(() => ({
  hash: location.hash,
  h1: document.querySelector('h1, h2')?.textContent || '',
  bodySnippet: (document.body.textContent || '').replace(/\s+/g, ' ').slice(0, 300),
  articleCount: document.querySelectorAll('article').length,
}));
dump('حالة صفحة القسم', categoryState);

// 3) مسار الإدارة
errors.length = 0;
await page.evaluate(() => { location.hash = '#/admin'; });
await new Promise((r) => setTimeout(r, 3000));
const adminState = await page.evaluate(() => ({
  hash: location.hash,
  bodySnippet: (document.body.textContent || '').replace(/\s+/g, ' ').slice(0, 250),
}));
dump('حالة #/admin', adminState);

console.log('\n=== كل الأخطاء الملتقطة ===');
errors.slice(0, 25).forEach((e) => console.log(e));
await browser.close();
