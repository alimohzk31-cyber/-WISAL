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
await page.goto(`${BASE}/#/category/public`, { waitUntil: 'networkidle2', timeout: 90000 });
await sleep(2000);
console.log('hash:', await page.evaluate(() => location.hash));
const info = await page.evaluate(() => {
  const h3s = [...document.querySelectorAll('h3')].map((e) => JSON.stringify(e.textContent));
  const h2s = [...document.querySelectorAll('h2')].map((e) => JSON.stringify(e.textContent));
  const body = document.body.innerText;
  const mentionAbuFiroz = body.includes('ابو فيروز');
  const mentionRasoul = body.includes('شركة الرسول');
  const mentionRasoul2 = body.includes('الرسول');
  const mentionGeneralCount = (body.match(/خدمات عامة/g) || []).length;
  const articleCount = document.querySelectorAll('article').length;
  const hoverCards = [...document.querySelectorAll('[class*="line-clamp"]')].map((e) => JSON.stringify(e.textContent));
  return { h3s, h2s, mentionAbuFiroz, mentionRasoul, mentionRasoul2, mentionGeneralCount, articleCount, hoverCards };
});
console.log(info);
await browser.close();
process.exit(0);