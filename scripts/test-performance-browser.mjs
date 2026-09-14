// Real app + browser, synthetic Supabase only. No production reads or writes.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.argv[2] || 'http://localhost:3001';
const mode = process.argv[3] || 'development-strict';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const checks = [];
const requests = [];
const errors = [];
let serviceCount = 5;
let pageDelay = 80;
let failLaterPages = false;
const row = id => ({ id, slug: `perf-${id}`, title: `Perf service ${id}`, category_id: 'pharmacy', category_slug: 'pharmacy', status: 'approved', image_url: '', created_at: new Date(1700000000000 + id * 1000).toISOString(), reviewed_at: new Date(1700000000000 + id * 1000).toISOString(), views: 1 });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  page.on('pageerror', error => errors.push(String(error)));
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = new URL(request.url());
    if (url.origin === new URL(base).origin || ['data:', 'blob:'].includes(url.protocol)) return request.continue();
    if (!url.hostname.endsWith('supabase.co')) return request.respond({ status: 200, contentType: 'text/plain', body: '', headers });
    if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers });
    const table = url.pathname.split('/').at(-1);
    requests.push({ table, query: url.search, method: request.method() });
    let data = [];
    let status = 200;
    if (table === 'categories') data = [{ id: 'pharmacy', slug: 'pharmacy', name_ar: 'صيدليات', icon: 'Pill', color: 'green' }];
    if (table === 'services') {
      if (url.searchParams.get('select') === 'owner_id') data = [];
      else if (url.searchParams.has('owner_id')) data = [];
      else if (url.searchParams.has('id')) data = row(Number(url.searchParams.get('id').slice(3)));
      else {
        const offset = Number(url.searchParams.get('offset') || 0);
        const limit = Number(url.searchParams.get('limit') || 40);
        await sleep(offset ? pageDelay : 80);
        if (offset && failLaterPages) { status = 500; data = { code: 'TEST', message: 'Synthetic page failure' }; }
        else data = Array.from({ length: serviceCount }, (_, index) => row(serviceCount - index)).slice(offset, offset + limit);
      }
    }
    if (table === 'increment_visits' || table === 'increment_service_views') data = 2;
    if (table === 'is_admin') data = false;
    await request.respond({ status, contentType: 'application/json', body: JSON.stringify(data), headers });
  });
  const waitForHome = () => page.waitForFunction(() => document.querySelectorAll('article').length > 0, { timeout: 60_000 });
  const count = table => requests.filter(request => request.table === table).length;
  await page.goto(base, { waitUntil: 'networkidle2', timeout: 60_000 });
  await waitForHome();
  await sleep(500);
  assert.equal(count('categories'), 1, 'one shared categories request');
  assert.equal(count('slider_images'), 1, 'one slider request including StrictMode');
  assert.equal(count('admin_notifications'), 1, 'one initial notifications request');
  assert.equal(count('stats'), 0, 'Layout does not read unused stats');
  assert.equal(count('increment_visits'), 1, 'StrictMode does not double-count visits');
  assert.equal(requests.filter(request => request.table === 'services' && request.query.includes('status=eq.approved') && !request.query.includes('id=')).length, 1, 'short first page needs no second page');
  checks.push('Initial requests are deduplicated; no empty trailing services page or unused stats read.');
  const initialRequests = [...requests];
  const assets = await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => /\.(js|css)(\?|$)/.test(entry.name)).map(entry => ({ url: entry.name, bytes: entry.encodedBodySize })));
  if (mode === 'production') assert.ok(!assets.some(asset => /AdminDashboard|AddServiceModal|SmartSearchModal|SuggestionsFeedModal|AppVersionModal/.test(asset.url)), 'closed heavy pages/modals must not be downloaded initially');
  await page.evaluate(() => { location.hash = '#/about'; });
  await page.waitForFunction(() => location.hash === '#/about' && !document.querySelector('article'));
  await page.evaluate(() => { location.hash = '#/'; });
  await waitForHome();
  await sleep(500);
  assert.equal(count('categories'), 1);
  assert.equal(count('slider_images'), 1);
  assert.equal(count('service_reactions'), 1);
  checks.push('Returning to Home reuses categories, slider and interaction caches.');

  await page.evaluate(() => { location.hash = '#/?view=services'; });
  await page.waitForSelector('input[type="text"]');
  const beforeTyping = requests.length;
  await page.type('input[type="text"]', 'صيدلية', { delay: 15 });
  await sleep(500);
  assert.equal(requests.length, beforeTyping, 'typing must not issue backend requests');
  assert.ok((await page.evaluate(() => location.hash)).includes('q='));
  checks.push('Typing searches locally and updates the URL after settling.');

  await page.evaluate(() => { location.hash = '#/service/5'; });
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.textContent.includes('Perf service 5'));
  await sleep(300);
  const detailReads = () => requests.filter(request => request.table === 'services' && new URLSearchParams(request.query).get('id') === 'eq.5').length;
  assert.equal(detailReads(), 1, 'StrictMode shares the service detail request');
  await page.evaluate(() => { location.hash = '#/about'; });
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await page.evaluate(() => { location.hash = '#/service/5'; });
  await page.waitForFunction(() => document.querySelector('[role="dialog"]')?.textContent.includes('Perf service 5'));
  await sleep(200);
  assert.equal(detailReads(), 1, 'returning to service details reuses the cache');
  checks.push('Detail pages share in-flight requests under StrictMode and reuse cached data on return.');

  // Reload with a cached row absent from the first fresh page; delay/fail the next page.
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const open = indexedDB.open('SaleenService');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('offline_data', 'readwrite');
        tx.objectStore('offline_data').put([{ id: 1000, slug: 'retained-cache', name: 'Retained cached service', categorySlug: 'pharmacy', status: 'approved', createdAt: Date.now(), reviewedAt: Date.now(), image: '', location: '' }], 'cached_services');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
    location.hash = '#/';
  });
  serviceCount = 85; pageDelay = 2000; failLaterPages = true;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('Retained cached service'));
  await sleep(900);
  assert.ok(await page.evaluate(() => document.body.innerText.includes('Retained cached service')), 'partial refresh retains old rows');
  await sleep(1800);
  assert.ok(await page.evaluate(() => document.body.innerText.includes('Retained cached service')), 'page error retains old rows');
  assert.equal(await page.$$eval('article', nodes => nodes.length), 12, 'feed mounts only its first batch');
  checks.push('Cached services remain visible during a slow refresh and after a later-page error; initial feed is bounded to 12 posts.');

  failLaterPages = false; pageDelay = 80;
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.querySelectorAll('article').length === 12 && !document.body.innerText.includes('Retained cached service'));
  const more = await page.$$('button');
  let clicked = false;
  for (const button of more) if ((await button.evaluate(node => node.textContent)).trim() === 'عرض المزيد') { await button.click(); clicked = true; break; }
  assert.ok(clicked);
  await page.waitForFunction(() => document.querySelectorAll('article').length === 24);
  checks.push('Complete refresh removes obsolete cache rows; Load more reveals the next 12 posts.');
  assert.deepEqual(errors, []);
  await mkdir('release/performance-1.1', { recursive: true });
  await page.screenshot({ path: `release/performance-1.1/${mode}.png`, fullPage: false });
  await writeFile(`release/performance-1.1/${mode}.json`, JSON.stringify({ scope: 'Synthetic responses, all external requests intercepted; not production timings.', checks, initialRequests, assets, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ mode, checks, initialRequests: initialRequests.length, pageErrors: errors }, null, 2));
} finally { await browser.close(); }
