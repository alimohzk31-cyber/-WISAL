import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-first-run', '--window-size=1280,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + String(e)));

for (const slug of ['public', 'cars', 'construction']) {
  console.log(`\n===== FRESH LOAD #/category/${slug} =====`);
  const target = `${BASE}/#/category/${slug}`;
  await page.goto(target, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(2500);
  const dump = await page.evaluate(() => {
    const h1s = [...document.querySelectorAll('h1')].map((e) => e.textContent + '');
    const titles = [...document.querySelectorAll('h3')].map((e) => e.textContent + '');
    const countText = [...document.querySelectorAll('span')].filter((e) => (e.textContent || '').includes('خدمة')).map((e) => e.textContent + '');
    return { hash: location.hash, h1s, titles, countText, body: document.body.innerText.slice(0, 1200) };
  });
  console.log(JSON.stringify(dump, null, 1));
  await sleep(500);
}
console.log('\nCONSOLE/PAGE ERRORS:', JSON.stringify(consoleErrors, null, 1));
await browser.close();
process.exit(0);