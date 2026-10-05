import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] || 'http://127.0.0.1:3000';
const output = '.cache/slider-links-bar';
fs.mkdirSync(output, { recursive: true });
const image = `data:image/webp;base64,${fs.readFileSync('public/category-photos/cars.webp').toString('base64')}`;
const complete = { button_text: 'GitHub', button_link: 'https://github.com/example/repository', facebook_url: 'https://facebook.com/example', instagram_url: 'https://instagram.com/example', tiktok_url: 'https://tiktok.com/@example', twitter_url: 'https://x.com/example' };
const fixtures = [
  ...['left', 'right', 'top', 'bottom'].map(social_icons_position => ({ ...complete, social_icons_position })),
  { instagram_url: 'https://instagram.com/example' },
  { button_link: 'https://example.com/' },
  { button_link: 'https://wa.me/9647700000000', social_icons_position: 'bottom' },
  { button_link: 'javascript:alert(1)', facebook_url: '', instagram_url: null, tiktok_url: 'javascript:alert(1)' },
  { button_link: '/jobs', button_text: 'Open jobs' },
];
const slides = fixtures.map((links, i) => ({ id: i + 1, title: `Slider title ${i + 1}`, images: [image], is_active: true, sort_order: i, ...links }));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin === base || ['data:', 'blob:'].includes(url.protocol)) return request.continue();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers });
    const endpoint = url.pathname.split('/').at(-1);
    return request.respond({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(endpoint === 'slider_images' ? slides : endpoint === 'is_admin' ? false : []) });
  });
  for (const width of [320, 390, 1280]) {
    await page.setViewport({ width, height: 900 });
    await page.goto(`${base}/#/`);
    await page.waitForSelector('[data-testid="services-slider"] [data-slide-id="1"]');
    // Disable autoplay only in the test document so assertions can inspect each slide deterministically.
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); window.scrollTo(0, 0); });
    for (let index = 0; index < slides.length; index++) {
      await page.evaluate(({ index, count }) => document.querySelector(`[data-testid="services-slider"] button[aria-label="الشريحة ${index + 1} من ${count}"]`).click(), { index, count: slides.length });
      await page.waitForFunction(index => document.querySelector('[data-testid="services-slider"] [data-slide-id]')?.dataset.slideId === String(index + 1), {}, index);
      await page.waitForFunction(() => { const image = document.querySelector('[data-testid="services-slider"] img'); return image?.complete && image.naturalWidth > 0; });
      await new Promise(resolve => setTimeout(resolve, 550));
      const result = await page.evaluate(() => {
        const frame = document.querySelector('[data-testid="services-slider"]'), rect = frame.getBoundingClientRect();
        const bar = frame.querySelector('[data-slider-links]'), barRect = bar?.getBoundingClientRect();
        const titleRect = frame.querySelector('h1').getBoundingClientRect(), dotsRect = frame.querySelector('[data-slider-dots]').getBoundingClientRect();
        const overlap = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
        const style = getComputedStyle(frame.querySelector('img'));
        return { frameHeight: rect.height, barTop: barRect?.top, barBottom: barRect?.bottom, frameBottom: rect.bottom, barHeight: barRect?.height,
          titleBottom: titleRect.bottom, dotsTop: dotsRect.top, wrapperHeight: frame.parentElement.getBoundingClientRect().height,
          positionValue: bar?.dataset.socialIconsPosition,
          inside: !barRect || (barRect.left >= rect.left + 4 && barRect.right <= rect.right - 4 && barRect.top >= rect.top + 4 && barRect.bottom <= rect.bottom - 4),
          titleOverlap: overlap(barRect, titleRect),
          dotOverlap: [...frame.querySelectorAll('[data-slider-dots] button')].some(dot => overlap(barRect, dot.getBoundingClientRect())),
          aligned: !barRect || ({ left: Math.abs(barRect.left - rect.left - 8) < 1, right: Math.abs(rect.right - barRect.right - 8) < 1, top: Math.abs(barRect.top - rect.top - 8) < 1, bottom: Math.abs(rect.bottom - barRect.bottom - 16) < 1 })[bar.dataset.socialIconsPosition],
          overflow: document.documentElement.scrollWidth > innerWidth + 1, fit: style.objectFit, position: style.objectPosition,
          title: frame.querySelector('h1').textContent, dots: frame.querySelectorAll('button[aria-label]').length,
          links: [...(bar?.querySelectorAll('a') ?? [])].map(link => ({ href: link.getAttribute('href'), label: link.getAttribute('aria-label'), text: link.textContent.trim(), target: link.target, rel: link.rel,
            width: link.getBoundingClientRect().width, height: link.getBoundingClientRect().height, iconWidth: link.querySelector('svg').getBoundingClientRect().width, icon: Boolean(link.querySelector('svg')), github: Boolean(link.querySelector('.lucide-github')), globe: Boolean(link.querySelector('.lucide-globe')) })) };
      });
      assert.equal(result.links.length, [5, 5, 5, 5, 1, 1, 1, 0, 1][index]);
      assert.equal(result.title, slides[index].title); assert.equal(result.dots, Math.min(7, slides.length));
      assert.equal(result.fit, 'cover'); assert.equal(result.position, '50% 50%'); assert.equal(result.overflow, false);
      assert.equal(result.frameHeight, width < 768 ? 165 : 230);
      assert.equal(result.wrapperHeight, result.frameHeight, 'Links never add slider height');
      if (result.links.length) {
        assert.equal(result.positionValue, fixtures[index].social_icons_position ?? 'left');
        assert.equal(result.inside, true, 'Icons stay inside image');
        assert.equal(result.aligned, true, 'Saved position determines placement');
        assert.equal(result.titleOverlap, false, 'Icons do not overlap title');
        assert.equal(result.dotOverlap, false, 'Icons do not overlap navigation dots');
      }
      for (const link of result.links) {
        assert.equal(link.text, ''); assert.equal(link.icon, true);
        assert.equal(Math.round(link.width), width < 768 ? 24 : 28); assert.equal(link.width, link.height);
        assert.equal(Math.round(link.iconWidth), width < 768 ? 14 : 16);
        if (!link.href.startsWith('#')) { assert.equal(link.target, '_blank'); assert.ok(link.rel.includes('noopener') && link.rel.includes('noreferrer')); }
      }
      if (index < 4) { assert.deepEqual(result.links.map(link => link.href), [complete.facebook_url, complete.instagram_url, complete.tiktok_url, complete.twitter_url, complete.button_link]); assert.equal(result.links.at(-1).github, true); }
      if (index === 5) assert.equal(result.links[0].globe, true);
      if (index === 6) assert.equal(result.links[0].label, 'WhatsApp');
      if (index === 8) assert.equal(result.links[0].href, '#/jobs');
      if (index < 4 || index === 6) await page.screenshot({ path: `${output}/${width}-${index}.png` });
    }
    // Swipe still changes slides and the overlay follows the active slide.
    const frame = await page.$('[data-testid="services-slider"]');
    const rect = await frame.boundingBox();
    await page.mouse.move(rect.x + rect.width * .75, rect.y + rect.height / 2);
    await page.mouse.down(); await page.mouse.move(rect.x + rect.width * .25, rect.y + rect.height / 2, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('[data-testid="services-slider"] [data-slide-id]')?.dataset.slideId === '1');
    await page.waitForSelector('[data-slider-links] a[aria-label="GitHub"]');
    console.log(`PASS ${width}px: saved left/right/top/bottom and legacy-left fallback; small icons; no title/dot overlap; GitHub/Globe/WhatsApp; swipe preserved`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
