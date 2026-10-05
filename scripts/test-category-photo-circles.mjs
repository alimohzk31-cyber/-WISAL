import assert from 'node:assert/strict';
import fs from 'node:fs';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer-core';
import { categories } from '../src/data/categories.ts';
import { buildCategoryDirectory } from '../src/data/categoryDirectory.ts';

// Read the same current rows and merge them as useCategories does; never seed new categories.
for (const path of ['.env', '.env.local']) if (fs.existsSync(path)) dotenv.config({ path, quiet: true });
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/categories?select=id,slug,name_ar,name_en,icon,parent_id`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000),
});
assert.equal(response.status, 200, 'Read current category rows');
const rows = await response.json();
const custom = rows.map(d => ({ slug: d.slug ?? d.id, dbId: d.id, name: d.name_ar ?? d.name ?? d.id, icon: d.icon ?? 'Folder' }));
const merged = [...custom, ...categories].reduce((items, item) => {
  if (!items.some(existing => existing.slug === item.slug || (item.dbId != null && existing.dbId != null && String(existing.dbId) === String(item.dbId)))) items.push(item);
  return items;
}, []);
const expected = buildCategoryDirectory(merged).sections;
const manifest = JSON.parse(fs.readFileSync('public/category-thumbnails/manifest.json', 'utf8'));
const available = new Set(manifest.map(item => item.slug));
const missing = expected.filter(section => !available.has(section.slug));
assert.equal(expected.length, 77);
assert.equal(missing.length, 11);
const base = process.argv[2] || 'http://127.0.0.1:3000';
fs.mkdirSync('.cache/category-review', { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  let failDoctorPhoto = false;
  const errors = [], broken = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('response', response => { if (response.url().startsWith(base) && /category-(?:photos|thumbnails)\/.*\.webp/.test(response.url()) && response.status() >= 400) broken.push(response.url()); });
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (failDoctorPhoto && url.origin === base && url.pathname.endsWith('/category-thumbnails/doctors.webp')) return request.abort('failed');
    if (url.origin === base || ['data:', 'blob:'].includes(url.protocol)) return request.continue();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (request.method() === 'OPTIONS') return request.respond({ status: 204, headers });
    const endpoint = url.pathname.split('/').at(-1);
    const services = ['doctors', 'welding'].map((slug, index) => ({ id: 77 + index, slug: `photo-test-${slug}`, title: `Photo test ${slug}`, category_id: slug, category_slug: slug, status: 'approved', views: 20, description: 'Details', created_at: '2026-01-01T00:00:00Z' }));
    return request.respond({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(endpoint === 'categories' ? rows : endpoint === 'services' ? services : endpoint === 'is_admin' ? false : []) });
  });
  for (const width of [390, 1280]) {
    await page.setViewport({ width, height: 900 });
    await page.goto(`${base}/#/?view=services`);
    await page.waitForFunction(count => document.querySelectorAll('[data-category-card-visual]').length === count, {}, expected.length);
    await page.evaluate(() => window.scrollTo(0, 0));
    const actual = await page.evaluate(async () => {
      const circles = [...document.querySelectorAll('[data-category-card-visual]')];
      const images = circles.flatMap(circle => [...circle.querySelectorAll('img')]);
      images.forEach(image => { image.loading = 'eager'; });
      await Promise.all(images.map(image => image.decode()));
      return circles.map(circle => {
        const image = circle.querySelector('img'), link = circle.closest('a'), rect = circle.getBoundingClientRect();
        return { slug: circle.dataset.categorySlug, status: circle.dataset.photoStatus, width: rect.width, height: rect.height,
          svg: circle.querySelectorAll('svg').length, text: circle.textContent.trim(), href: link.getAttribute('href'),
          name: link.querySelector('span').textContent, sameLink: !image || image.closest('a') === link.querySelector('span').closest('a'),
          image: image ? { width: image.naturalWidth, height: image.naturalHeight, fit: getComputedStyle(image).objectFit, position: getComputedStyle(image).objectPosition, radius: getComputedStyle(image).borderRadius, src: image.src } : null };
      });
    });
    assert.equal(actual.length, expected.length);
    assert.equal(actual.filter(item => item.image).length, 66);
    assert.equal(new Set(actual.filter(item => item.image).map(item => item.image.src)).size, 66);
    for (const item of actual) {
      assert.equal(item.name, expected.find(section => section.slug === item.slug).name);
      assert.equal(item.href, `#/category/${encodeURIComponent(item.slug)}`);
      assert.equal(item.svg, 0); assert.equal(item.text, ''); assert.equal(item.sameLink, true);
      assert.equal(item.width, 72); assert.equal(item.height, 72);
      assert.equal(Boolean(item.image), available.has(item.slug));
      if (item.image) { assert.equal(item.image.width, 192); assert.equal(item.image.height, 192); assert.equal(item.image.fit, 'cover'); assert.equal(item.image.position, '50% 50%'); assert.equal(item.image.radius, '50%'); }
      else assert.equal(item.status, 'missing');
    }
    await page.screenshot({ path: `.cache/category-review/current-${width}.png` });
    await page.screenshot({ path: `.cache/category-review/current-full-${width}.png`, fullPage: true });
    for (const slug of ['bakeries-ovens-sweets', 'construction-plumbing']) for (const selector of ['img', 'span']) {
      await page.goto(`${base}/#/?view=services`);
      await page.waitForSelector(`a[href="#/category/${slug}"] img`);
      const target = await page.$(`a[href="#/category/${slug}"] ${selector}`);
      await target.evaluate(element => element.scrollIntoView({ block: 'center' }));
      await new Promise(resolve => setTimeout(resolve, 250));
      console.log(`Click ${width}px ${slug} ${selector}`);
      await target.click();
      await page.waitForFunction(slug => location.hash.startsWith(`#/category/${slug}`), {}, slug);
    }
    await page.goto(`${base}/#/?view=browse`);
    await page.waitForSelector('article [data-category-card-visual]');
    await page.waitForFunction(() => document.querySelector('article img[alt]')?.complete);
    const feed = await page.evaluate(async () => {
      const circles = [...document.querySelectorAll('article [data-category-card-visual]')];
      await Promise.all(circles.flatMap(circle => [...circle.querySelectorAll('img')]).map(image => image.decode()));
      return circles.map(circle => ({ slug: circle.dataset.categorySlug, status: circle.dataset.photoStatus, svg: circle.querySelectorAll('svg').length, image: Boolean(circle.querySelector('img')?.naturalWidth) }));
    });
    assert.ok(feed.some(item => item.slug === 'doctors' && item.image));
    assert.ok(feed.some(item => item.slug === 'welding' && !item.image && item.status === 'missing'));
    assert.ok(feed.every(item => item.svg === 0));
    await page.screenshot({ path: `.cache/category-review/browse-${width}.png` });
    for (const selector of ['[data-category-slug="doctors"]', 'button.truncate']) {
      await page.goto(`${base}/#/?view=browse`);
      await page.waitForSelector(selector);
      await (await page.$(selector)).click();
      await page.waitForFunction(() => location.hash.startsWith('#/category/doctors'));
    }
    console.log(`PASS ${width}px: ${actual.length} current categories, 66 actual photos, 11 neutral circles; browse avatars use photos; image/name routes preserved`);
  }
  assert.deepEqual(errors, []); assert.deepEqual(broken, []);
  failDoctorPhoto = true;
  await page.setCacheEnabled(false);
  await page.goto(`${base}/#/?view=services`);
  await page.waitForSelector('[data-category-slug="doctors"]');
  await page.evaluate(() => { const image = document.querySelector('[data-category-slug="doctors"] img'); if (image) image.loading = 'eager'; });
  await page.waitForSelector('[data-category-slug="doctors"][data-photo-status="missing"]');
  assert.equal(await page.$eval('[data-category-slug="doctors"]', circle => circle.querySelectorAll('img,svg').length), 0);
  assert.equal(await page.$eval('[data-category-slug="doctors"]', circle => circle.textContent.trim()), '');
  console.log('PASS: failed photo becomes a neutral circle with no broken image or icon fallback');
  fs.writeFileSync('.cache/category-review/current-report.json', JSON.stringify({ total: expected.length, photos: 66, missing: missing.map(({ slug, name }) => ({ slug, name })), emoji: 0, icons: 0, broken: broken.length, mobile: 'PASS', desktop: 'PASS' }, null, 2));
  console.log('PASS: no broken category images, SVG, emoji, or page errors');
} finally { await browser.close(); }
