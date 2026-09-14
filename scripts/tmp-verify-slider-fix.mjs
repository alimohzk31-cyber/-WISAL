// اختبار نهائي شامل: الرئيسية، الوظائف، سلايدر الوظائف، لوحة الإدارة — بدون White Screen
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const candidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];
const { existsSync } = await import('node:fs');
const exe = candidates.find(c => existsSync(c));
if (!exe) { console.log('NO_BROWSER'); process.exit(1); }

const routes = [
  { hash: '#/', name: 'home', expect: ['وصال', 'خدمات'] },
  { hash: '#/jobs', name: 'jobs', expect: ['البحث والتصفية', 'فرصتك الجديدة تبدأ من وصال'] },
  { hash: '#/admin', name: 'admin', expect: ['لوحة التحكم', 'PIN', 'الرمز', 'دخول'] },
];
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200)); });
page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message.slice(0, 200)));

const results = {};
for (const r of routes) {
  consoleErrors.length = 0;
  await page.goto(`http://localhost:3000/${r.hash}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(res => setTimeout(res, 6000));
  const state = await page.evaluate(() => ({
    rootLen: document.getElementById('root')?.innerHTML.length ?? 0,
    text: (document.body.innerText || '').slice(0, 400),
    imgs: [...document.querySelectorAll('img')].filter(i => i.src.includes('service-media')).length,
    hasButtonError: (document.body.innerText || '').includes('button_text does not exist'),
  }));
  const whiteScreen = state.rootLen < 500;
  const expectationsMet = r.expect.some(e => state.text.includes(e));
  results[r.name] = { whiteScreen, expectationsMet, noButtonError: !state.hasButtonError, rootLen: state.rootLen, imgs: state.imgs, errors: [...consoleErrors] };
  await page.screenshot({ path: `.cleanup-work/test-${r.name}.png` });
}
writeFileSync('.cleanup-work/final-browser-test.json', JSON.stringify(results, null, 1), 'utf8');
await browser.close();
console.log(JSON.stringify(results, null, 1));
