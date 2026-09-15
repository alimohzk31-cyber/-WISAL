import puppeteer from 'puppeteer-core';
const BASE = process.env.WISAL_UI_BASE || 'http://127.0.0.1:3100';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true, args: ['--no-first-run', '--window-size=1440,1000'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1000 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 220)}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${String(e).slice(0, 220)}`));
const reqs = [];
page.on('response', (r) => {
  const u = r.url();
  if (u.includes('/rest/v1/services') || u.includes('supabase')) reqs.push(`${r.status()} ${u.slice(0, 130)}`);
});
if (process.env.HIDE === 'true') {
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  });
}
await page.goto(`${BASE}/#/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(3000);
// فحص سلسلة جلب صورة الخدمة نفسها التي يستخدمها السلايدر
const probe = await page.evaluate(async () => {
  const timeout = (ms) => new Promise((resolve) => setTimeout(() => resolve('__TIMEOUT__'), ms));
  try {
    const media = await import('/src/lib/serviceMedia.ts');
    const t0 = Date.now();
    const cached = await Promise.race([media.getCachedServiceImage(92), timeout(5000)]);
    const afterCached = Date.now() - t0;
    const fresh = await Promise.race([media.fetchServiceImage(92), timeout(10000)]);
    return {
      afterCached,
      cached: String(cached).slice(0, 34),
      afterFresh: Date.now() - t0,
      fresh: String(fresh).slice(0, 34),
      freshLength: String(fresh).length,
    };
  } catch (error) {
    return { error: String(error) };
  }
});
console.log('PROBE=' + JSON.stringify(probe));
await sleep(6000);
const stateAfter = await page.evaluate(() => {
  const slider = document.querySelector('[data-testid="services-slider"]');
  const img = slider?.querySelector('img[data-slide-layer="foreground"]');
  return {
    kind: img ? String(img.src).slice(0, 26) : null,
    natural: img ? `${img.naturalWidth}x${img.naturalHeight}` : null,
    loadingShimmer: Boolean(slider?.querySelector('[data-slide-loading]')),
  };
});
console.log('AFTER_PROBE=' + JSON.stringify(stateAfter));
const state = await page.evaluate(() => {
  const slider = document.querySelector('[data-testid="services-slider"]');
  const imgs = slider ? [...slider.querySelectorAll('img')].map((i) => ({
    layer: i.dataset.slideLayer || '—', kind: String(i.src).slice(0, 26),
    natural: `${i.naturalWidth}x${i.naturalHeight}`, complete: i.complete,
  })) : [];
  const dot = slider?.querySelector('[aria-label^="الشريحة"]');
  return {
    hasSlider: Boolean(slider),
    sliderText: slider ? slider.innerText.slice(0, 120) : null,
    loadingShimmer: Boolean(slider?.querySelector('[data-slide-loading]')),
    dotLabel: dot?.getAttribute('aria-label') || null,
    slideHolder: slider?.querySelector('[data-slide-id]')?.getAttribute('data-slide-id') || null,
    imgs,
    articles: document.querySelectorAll('article').length,
    bodyText: document.body.innerText.slice(0, 160),
  };
});
console.log(JSON.stringify(state, null, 2));
console.log('--- LOGS ---'); logs.slice(-25).forEach((l) => console.log(l));
console.log('--- REQS ---'); [...new Set(reqs)].slice(-20).forEach((l) => console.log(l));
await page.screenshot({ path: 'scripts/tmp-slider-debug.png' });
await browser.close();
