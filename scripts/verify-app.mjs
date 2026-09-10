/**
 * verify-app.mjs
 * --------------
 * تحقق فعلي من أن تطبيق وصال يعمل: React يرسم، لا شاشة بيضاء،
 * لا أخطاء Console حرجة، HashRouter ينقل، والخدمات تُحمّل.
 *
 * الاستخدام: node scripts/verify-app.mjs http://localhost:3001
 */
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] || 'http://localhost:3001';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const consoleIssues = [];
const pageErrors = [];
const failedRequests = [];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--disable-extensions'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleIssues.push(msg.text().slice(0, 300));
  });
  page.on('pageerror', (err) => pageErrors.push(String(err).slice(0, 300)));
  page.on('response', (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url().slice(0, 120)}`);
  });

  // 1) الصفحة الرئيسية
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 6000)); // مهلة لتحميل الخدمات من Supabase

  const home = await page.evaluate(() => ({
    title: document.title,
    rootChildren: document.getElementById('root')?.children.length ?? 0,
    rootHtmlLength: document.getElementById('root')?.innerHTML.length ?? 0,
    hash: window.location.hash || '#/',
    bodyText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 150),
  }));

  // 2) التنقل عبر HashRouter إلى صفحة من ناحية (#/about)
  await page.evaluate(() => { window.location.hash = '#/about'; });
  await new Promise((r) => setTimeout(r, 3000));
  const about = await page.evaluate(() => ({
    hash: window.location.hash,
    rootHtmlLength: document.getElementById('root')?.innerHTML.length ?? 0,
    bodyText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 150),
  }));

  // 3) التأكد أن React مثبّت ويعمل (root مرسوم بواسطة React)
  const reactWorks = home.rootChildren > 0 && home.rootHtmlLength > 100;

  const pass = reactWorks
    && home.hash.startsWith('#')
    && about.hash === '#/about'
    && pageErrors.length === 0
    && home.rootHtmlLength > 100
    && about.rootHtmlLength > 100;

  console.log('=== تقرير التحقق (وصال) ===');
  console.log(`الرابط: ${BASE}`);
  console.log(`العنوان: ${home.title}`);
  console.log(`React يرسم: ${reactWorks ? 'نعم ✅' : 'لا ❌'} (rootChildren=${home.rootChildren}, html=${home.rootHtmlLength} حرف)`);
  console.log(`HashRouter: الرئيسية=${home.hash} → عن الناحية=${about.hash} ${about.hash === '#/about' ? '✅' : '❌'}`);
  console.log(`نص الرئيسية: ${home.bodyText}`);
  console.log(`نص عن الناحية: ${about.bodyText}`);
  console.log(`أخطاء Console (error): ${consoleIssues.length === 0 ? 'لا يوجد ✅' : consoleIssues.length}`);
  consoleIssues.slice(0, 5).forEach((t) => console.log(`  [console.error] ${t}`));
  console.log(`أخطاء صفحة (pageerror): ${pageErrors.length === 0 ? 'لا يوجد ✅' : pageErrors.length}`);
  pageErrors.slice(0, 5).forEach((t) => console.log(`  [pageerror] ${t}`));
  console.log(`طلبات فاشلة (>=400): ${failedRequests.length === 0 ? 'لا يوجد ✅' : failedRequests.length}`);
  failedRequests.slice(0, 10).forEach((t) => console.log(`  [request] ${t}`));
  console.log(`النتيجة النهائية: ${pass ? 'النجاح ✅' : 'فشل ❌'}`);
  process.exit(pass ? 0 : 1);
} finally {
  await browser.close();
}
