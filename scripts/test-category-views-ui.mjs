import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] || 'http://127.0.0.1:3000';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  let visits = 0;
  const row = { id: 77, slug: 'views-test', title: 'Views test', category_id: 'doctors', category_slug: 'doctors', status: 'approved', views: 20, description: 'Detail '.repeat(80), created_at: '2026-01-01T00:00:00Z' };
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = new URL(request.url());
    if (url.origin === base || ['data:', 'blob:'].includes(url.protocol)) return request.continue();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers });
    const endpoint = url.pathname.split('/').at(-1);
    let data = [];
    if (endpoint === 'services') data = [{ ...row, views: 20 + visits }];
    if (endpoint === 'categories') data = [{ id: 'doctors', slug: 'doctors', name_ar: 'الأطباء' }];
    if (endpoint === 'increment_service_views') {
      assert.deepEqual(JSON.parse(request.postData()), { p_service_id: 77 });
      data = 20 + ++visits;
    }
    if (endpoint === 'is_admin') data = false;
    await request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(data), headers });
  });
  const wait = () => new Promise(resolve => setTimeout(resolve, 350));
  const click = label => page.evaluate(label => {
    const button = [...document.querySelectorAll('article button')].find(node => node.textContent.trim() === label);
    assertButton(button);
    function assertButton(button) { if (!button) throw new Error(`Missing ${label}`); }
    button.click();
  }, label);
  await page.goto(`${base}/#/?view=browse`);
  await page.waitForSelector('article');
  await wait();
  assert.equal(visits, 0, 'Displaying cards must not count');
  await click('المزيد');
  await page.waitForFunction(() => document.querySelector('article [aria-label="21 زيارة"]'));
  assert.equal(visits, 1);
  await page.setViewport({ width: 390, height: 844 });
  await wait();
  assert.equal(visits, 1, 'Render/viewport changes must not count');
  await click('عرض أقل');
  await wait();
  assert.equal(visits, 1, 'Collapse must not count');
  await click('المزيد');
  await page.waitForFunction(() => document.querySelector('article [aria-label="22 زيارة"]'));
  assert.equal(visits, 2, 'A new deliberate expansion counts');

  for (const width of [390, 1280]) {
    await page.setViewport({ width, height: 900 });
    for (const selector of ['img', 'span']) {
      await page.goto(`${base}/#/?view=services`);
      await page.waitForSelector('a[href="#/category/doctors"] img');
      if (selector === 'img') {
        const visuals = await page.evaluate(async () => {
          const circles = [...document.querySelectorAll('[data-category-card-visual]')];
          const images = circles.flatMap(circle => [...circle.querySelectorAll('img')]);
          images.forEach(image => { image.loading = 'eager'; });
          await Promise.all(images.map(image => image.decode()));
          return circles.map(circle => {
            const rect = circle.getBoundingClientRect(), image = circle.querySelector('img');
            const link = circle.closest('a');
            return { width: rect.width, height: rect.height, radius: getComputedStyle(circle).borderRadius,
              fit: image ? getComputedStyle(image).objectFit : null,
              position: image ? getComputedStyle(image).objectPosition : null,
              hasVisual: Boolean(image?.complete && image.naturalWidth === 192 && image.naturalHeight === 192),
              imageCount: circle.querySelectorAll('img').length,
              svgCount: circle.querySelectorAll('svg').length,
              imagePath: new URL(image.src).pathname,
              sameLink: image.closest('a') === link.querySelector('span').closest('a'),
              href: link.getAttribute('href'), name: link.querySelector('span').textContent };
          });
        });
        assert.equal(visuals.length, 64);
        for (const visual of visuals) {
          assert.equal(visual.width, 72); assert.equal(visual.height, 72);
          assert.ok(visual.radius === '50%' || parseFloat(visual.radius) >= 36);
          assert.equal(visual.hasVisual, true);
          assert.equal(visual.imageCount, 1);
          assert.equal(visual.svgCount, 0);
          assert.equal(visual.sameLink, true);
          assert.equal(visual.imagePath, `/category-thumbnails/${visual.href.split('/').at(-1)}.webp`);
          assert.ok(visual.href.startsWith('#/category/'));
          if (visual.fit) { assert.equal(visual.fit, 'cover'); assert.equal(visual.position, '50% 50%'); }
        }
        fs.mkdirSync('.cache/category-review', { recursive: true });
        fs.writeFileSync('.cache/category-review/categories.txt', visuals.map(v => v.name).join('\n') + '\n');
        await page.screenshot({ path: `.cache/category-review/circles-${width}.png`, fullPage: true });
        assert.equal(new Set(visuals.map(visual => visual.imagePath)).size, 64);
        console.log(`PASS: ${visuals.length} unique local photos in matching 72px circles at ${width}px; no broken images or SVG; image/name share every category link`);
      }
      const link = await page.$('a[href="#/category/doctors"]');
      const image = await link.$('img');
      await image.scrollIntoView();
      await page.waitForFunction(() => {
        const image = document.querySelector('a[href="#/category/doctors"] img');
        return image?.complete && image.naturalWidth > 0;
      });
      await (await link.$(selector)).click();
      await page.waitForFunction(() => location.hash.startsWith('#/category/doctors'));
      assert.equal(visits, 2, 'Category entry must not count');
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
  }
  await page.waitForSelector('[class*="cursor-pointer"] h3');
  await page.evaluate(() => [...document.querySelectorAll('h3')].find(node => node.textContent === 'Views test').click());
  await page.waitForFunction(() => location.hash.startsWith('#/service/77'));
  await page.waitForFunction(() => document.body.textContent.includes('23'));
  await wait();
  assert.equal(visits, 3, 'Service entry counts exactly once');
  await page.setViewport({ width: 390, height: 844 });
  await wait();
  assert.equal(visits, 3);
  assert.deepEqual(errors, []);
  console.log('PASS: image/name clicks on mobile and desktop; more/service entry; no impression, collapse or render visits; displayed server counts');

  await page.goto(`${base}/#/?view=services`);
  await page.waitForSelector('a[href="#/category/doctors"] img');
  for (const width of [320, 390, 1280]) {
    await page.setViewport({ width, height: 844 });
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForSelector('[data-offline-notice]');
    const geometry = await page.evaluate(() => {
      const notice = document.querySelector('[data-offline-notice]');
      const rect = notice.getBoundingClientRect();
      const header = document.querySelector('header').getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, headerBottom: header.bottom,
        viewportHeight: innerHeight, pointerEvents: getComputedStyle(notice).pointerEvents,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        arabicDigits: /[٠-٩۰-۹]/.test(document.body.innerText) };
    });
    assert.ok(geometry.top > geometry.viewportHeight / 2, 'Notice stays at bottom');
    assert.ok(geometry.bottom <= geometry.viewportHeight - 15, 'Notice respects bottom spacing');
    assert.ok(geometry.top > geometry.headerBottom, 'Header remains uncovered');
    assert.equal(geometry.pointerEvents, 'none', 'Notice does not intercept controls');
    assert.equal(geometry.overflow, false, `No horizontal overflow at ${width}px`);
    assert.equal(geometry.arabicDigits, false, 'Visible UI numbers use English digits');
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(() => !document.querySelector('[data-offline-notice]'));
  }
  console.log('PASS: English numbers; offline notice at bottom; header uncovered; reconnect hides notice; mobile 320/390 and desktop 1280');

  const photos = fs.readdirSync('public/category-photos').filter(name => name.endsWith('.webp'));
  await page.setViewport({ width: 1200, height: Math.ceil(photos.length / 6) * 125 });
  await page.setContent(`<body style="margin:0;display:grid;grid-template-columns:repeat(6,200px)">${photos.map(name => `<div style="height:125px;font:11px sans-serif"><img style="width:200px;height:100px;object-fit:cover" src="data:image/webp;base64,${fs.readFileSync(`public/category-photos/${name}`).toString('base64')}">${name}</div>`).join('')}</body>`);
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  console.log(`PASS: all ${photos.length} local category photos decode successfully`);
  if (process.env.CATEGORY_REVIEW_IMAGE) await page.screenshot({ path: process.env.CATEGORY_REVIEW_IMAGE, fullPage: true });
} finally {
  await browser.close();
}
