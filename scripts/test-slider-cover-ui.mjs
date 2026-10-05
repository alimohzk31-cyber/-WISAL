// Actual app and screenshot pixel comparison; no live Supabase writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const base = process.env.WISAL_UI_BASE || 'http://127.0.0.1:3000';
const output = path.resolve('.cache/slider-review');
fs.mkdirSync(output, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  const images = await page.evaluate(() => [[600, 1200], [900, 900], [1600, 700]].map(([width, height]) => {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e6af62'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#65bdde'; ctx.fillRect(width * .25, 0, width * .5, height);
    ctx.fillStyle = '#96cc72'; ctx.fillRect(0, height * .45, width, height * .1);
    return c.toDataURL('image/png');
  }));
  images.push(`data:image/webp;base64,${fs.readFileSync('public/category-photos/cars--car-tires.webp').toString('base64')}`);
  const slides = images.map((image, i) => ({ id: i + 1, title: `Visual ${i + 1}`, images: [image], is_active: true, sort_order: i }));
  await page.setRequestInterception(true);
  page.on('request', async request => {
    const url = new URL(request.url());
    if (url.origin === new URL(base).origin || ['data:', 'blob:'].includes(url.protocol)) return request.continue();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers });
    const endpoint = url.pathname.split('/').at(-1);
    const data = endpoint === 'slider_images' ? slides
      : endpoint === 'jobs' ? [{ id: 'visual-job', title: 'Visual job', company: 'WISAL', status: 'approved', image_url: images[3], created_at: '2026-10-01T00:00:00Z' }]
      : endpoint === 'is_admin' ? false : endpoint === 'increment_visits' ? 1 : [];
    return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(data), headers });
  });
  const report = [];
  for (const viewport of [320, 390, 1280]) {
    await page.setViewport({ width: viewport, height: 900, deviceScaleFactor: 1 });
    for (const [route, testId] of [['/', 'services-slider'], ['/jobs', 'jobs-slider']]) {
      await page.bringToFront();
      await page.goto(`${base}/#${route}`, { waitUntil: 'domcontentloaded' });
      const selector = `[data-testid="${testId}"]`;
      await page.waitForFunction(selector => {
        const image = document.querySelector(`${selector} img`);
        return image?.complete && image.naturalWidth > 0;
      }, { timeout: 15000, polling: 100 }, selector).catch(async error => {
        console.error(JSON.stringify({ route, viewport, errors, text: await page.$eval('body', node => node.innerText) }));
        await page.screenshot({ path: path.join(output, 'failure.png') });
        throw error;
      });
      const count = testId === 'services-slider' ? images.length : 1;
      for (let index = 0; index < count; index++) {
        console.log(`Checking ${testId}/${viewport}/${index + 1}`);
        await page.bringToFront();
        if (index > 0) await page.evaluate(({ selector, index }) => document.querySelectorAll(`${selector} button[aria-label^="الشريحة"]`)[index].click(), { selector, index });
        await page.waitForFunction(({ selector, index, testId }) => {
          const image = document.querySelector(`${selector} img`);
          const holder = document.querySelector(`${selector} [data-slide-id]`);
          return image?.complete && image.naturalWidth > 0 && Number(getComputedStyle(holder).opacity) === 1
            && (testId !== 'services-slider' || holder.dataset.slideId === String(index + 1));
        }, { timeout: 30000, polling: 100 }, { selector, index, testId });
        const geometry = await page.evaluate(selector => {
          const slider = document.querySelector(selector), r = slider.getBoundingClientRect();
          const header = document.querySelector('header').getBoundingClientRect();
          const style = getComputedStyle(slider.querySelector('img'));
          return { x: r.x, y: r.y, width: r.width, height: r.height, gap: r.top - header.bottom,
            headerHeight: header.height, fit: style.objectFit, position: style.objectPosition, filter: style.filter,
            imageCount: slider.querySelectorAll('img').length, margins: [r.left, innerWidth - r.right],
            gradients: [...slider.querySelectorAll('*')].filter(n => getComputedStyle(n).backgroundImage.includes('gradient')).length };
        }, selector);
        assert.equal(geometry.gap, 5, `${testId}: gap at ${viewport}px`);
        assert.equal(geometry.headerHeight, 81, 'Header height preserved');
        assert.ok(Math.abs(geometry.margins[0] - geometry.margins[1]) <= 1);
        assert.equal(geometry.fit, 'cover'); assert.equal(geometry.position, '50% 50%');
        assert.equal(geometry.filter, 'none'); assert.equal(geometry.imageCount, 1); assert.equal(geometry.gradients, 0);
        const shot = await page.screenshot({ encoding: 'base64', clip: { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height } });
        const pixels = await page.evaluate(async ({ selector, shot, width, height }) => {
          const screenshot = new Image(), image = document.querySelector(`${selector} img`);
          screenshot.src = `data:image/png;base64,${shot}`; await screenshot.decode();
          const actual = document.createElement('canvas'), expected = document.createElement('canvas');
          actual.width = expected.width = screenshot.width; actual.height = expected.height = screenshot.height;
          const ac = actual.getContext('2d'), ec = expected.getContext('2d'); ac.drawImage(screenshot, 0, 0);
          ec.imageSmoothingQuality = 'high';
          const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
          const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale;
          ec.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);
          return [8, Math.floor(width / 2), Math.floor(width - 9)].map(x => {
            const y = Math.floor(height / 2), rendered = [...ac.getImageData(x,y,1,1).data].slice(0,3), original = [...ec.getImageData(x,y,1,1).data].slice(0,3);
            return { x, rendered, original, delta: Math.max(...rendered.map((v,i) => Math.abs(v-original[i]))) };
          });
        }, { selector, shot, width: geometry.width, height: geometry.height });
        // Native CSS and canvas can use different resampling kernels on photos.
        // Solid fixture samples must match exactly; photos allow small RGB drift.
        const tolerance = testId === 'services-slider' && index < 3 ? 1 : 16;
        for (const pixel of pixels) assert.ok(pixel.delta <= tolerance, `Undimmed edge ${testId}/${viewport}/${index}: ${JSON.stringify(pixel)}`);
        fs.writeFileSync(path.join(output, `${testId}-${viewport}-${index}.png`), Buffer.from(shot, 'base64'));
        if (index === count - 1) await page.screenshot({ path: path.join(output, `${testId}-${viewport}-page.png`) });
        report.push({ testId, viewport, slide: index + 1, gap: geometry.gap, pixels });
      }
    }
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`PASS: ${report.length} screenshot checks; gap 5px; unchanged header; centered cover; undimmed left/right pixels; mobile and desktop. Screenshots: ${output}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  const timer = setTimeout(() => browser.process()?.kill(), 5000);
  await browser.close().catch(() => undefined);
  clearTimeout(timer);
}
