// ---------------------------------------------------------------------------
// اختبار واجهة فعلي (UI) لظهور الخدمات داخل أقسامها — تطبيق وصال الحقيقي.
// المسار الكامل: Supabase -> mapRowToService -> useCategories -> buildCategoryDirectory
//   -> bySection -> فلترة صفحة القسم -> ظهور الخدمة في DOM.
// يعمل على خادم التطوير (vite) ومتصفح Chrome حقيقي (puppeteer-core).
// ---------------------------------------------------------------------------
import puppeteer from 'puppeteer-core';
import { writeFile } from 'node:fs/promises';

const BASE = process.env.WISAL_UI_BASE || 'http://localhost:3001';
const HOME = `${BASE}/#/`;
const SUPABASE_URL = 'https://nnxrjpitjxtceydlcxzm.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueHJqcGl0anh0Y2V5ZGxjeHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDkyMjMsImV4cCI6MjA5MTIyNTIyM30.Ui1IQ4OOJ8wngBoNIBNe0nTCQgfm0q8P7AjrKhyAU4w';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchApprovedGroundTruth() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/services?select=id,title,category_id,category_slug,profession,status&status=eq.approved&order=id.asc`,
    { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
  );
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  const rows = await res.json();
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title || ''),
    category: r.category_slug ?? null,
    categoryId: r.category_id != null ? String(r.category_id) : null,
    profession: r.profession ?? null,
  }));
}

const results = {
  approvedTotal: 0,
  shownInFeed: [],
  enteredSections: [],
  missingWithinSection: [],
  refreshFailures: [],
  errors: [],
  checks: [],
};
const pageErrors = [];
const sleepMs = 350;

function push(pass, message) { results.checks.push(`${pass ? 'PASS' : 'FAIL'}: ${message}`); }

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--window-size=1280,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
page.on('pageerror', (e) => pageErrors.push(String(e)));

async function waitForFeed() {
  await page.waitForFunction(() => document.querySelectorAll('article').length > 0, { timeout: 60000 });
  await sleep(sleepMs);
}
async function loadAllFeed() {
  for (let i = 0; i < 12; i++) {
    const moreBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.find((b) => (b.textContent || '').trim() === 'عرض المزيد') || null;
    });
    const found = moreBtn.asElement();
    if (!found) break;
    await found.click();
    await sleep(sleepMs + 150);
  }
}
async function bodyText() { return await page.evaluate(() => document.body.innerText); }
// Wait until the section page actually renders, then classify its state.
async function waitForTitleInSection(title, timeout = 30000) {
  const outcome = await Promise.race([
    page.waitForFunction(
      (t) => document.body.innerText.includes(t), { timeout }, title
    ).then(() => 'visible'),
    sleep(timeout).then(() => 'timeout'),
  ]);
  if (outcome !== 'visible') return outcome;
  const txt = await bodyText();
  if (txt.includes('القسم غير موجود') || txt.includes('لا توجد خدمات')) return 'empty';
  return 'visible';
}
async function enterSectionForTitle(title) {
  return await page.evaluate((t) => {
    const arts = [...document.querySelectorAll('article')];
    for (const art of arts) {
      if (!(art.textContent || '').includes(t)) continue;
      const btn = [...art.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'الدخول إلى القسم');
      if (btn) { btn.click(); return true; }
    }
    return false;
  }, title);
}
async function waitForCategoryUrl(timeout = 30000) {
  await page.waitForFunction(() => location.hash.includes('/category/'), { timeout });
  await sleep(sleepMs);
}
try {
  // ---------- ground truth ----------
  const truth = await fetchApprovedGroundTruth();
  results.approvedTotal = truth.length;
  console.log(`Ground truth approved services: ${truth.length}`);

  // ---------- 1) open the app (browse tab) ----------
  await page.goto(HOME, { waitUntil: 'networkidle2', timeout: 90000 });
  await waitForFeed();
  await loadAllFeed();
  const bodyHome = await bodyText();

  // ---------- 2) feed shows exactly approved, no pending/rejected ----------
  let missingInFeed = 0;
  for (const s of truth) {
    if (bodyHome.includes(s.title)) results.shownInFeed.push(`${s.id}:${s.title}`);
    else { missingInFeed++; results.missingWithinSection.push(`id=${s.id} | ${s.title} | missingFromBrowse`); }
  }
  push(missingInFeed === 0, `feed shows all approved services (${truth.length}/${truth.length})`);
  const feedArts = await page.$$eval('article', (arts) => arts.length);
  push(feedArts >= truth.length, `feed mounted ${feedArts} articles for ${truth.length} approved`);
  push(!bodyHome.includes('بانتظار موافقة') && !bodyHome.includes('قيد المراجعة') && !bodyHome.includes('مرفوضة'),
    'no pending / rejected badges shown to the user on browse');
for (let idx = 0; idx < truth.length; idx++) {
    const s = truth[idx];
    const tag = `[${idx + 1}/${truth.length}] id=${s.id} «${s.title}»`;
    try {
      // ensure the article is mounted (feed pagination may have reset after leaving/entering)
      if (!(await bodyText()).includes(s.title)) {
        await page.evaluate(() => { location.hash = '#/?view=browse'; });
        await waitForFeed();
        await loadAllFeed();
      }
      const ok = await enterSectionForTitle(s.title);
      if (!ok) { results.missingWithinSection.push(`id=${s.id} | ${s.title} | section-entry button not found`); continue; }
      await waitForCategoryUrl();
      const url = await page.evaluate(() => location.hash);
      const visibleInSection = await waitForTitleInSection(s.title);
      if (visibleInSection === 'visible') {
        results.enteredSections.push({ id: s.id, title: s.title, url });
        console.log(`  OK entry -> ${url} (${s.title})`);
      } else {
        results.missingWithinSection.push(`id=${s.id} | ${s.title} | entered ${url} but render=${visibleInSection}`);
        console.log(`  MISSING within section: ${url} (${s.title}) state=${visibleInSection}`);
      }

      // Refresh while inside the section — services must not disappear.
      await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForFunction(() => location.hash.includes('/category/'), { timeout: 30000 });
      const afterReload = await waitForTitleInSection(s.title);
      push(afterReload === 'visible', `refresh keeps id=${s.id} visible in ${url}`);
      if (afterReload !== 'visible') results.refreshFailures.push(`id=${s.id} | ${s.title} | ${url} state=${afterReload}`);
    } catch (e) {
      results.errors.push(`${tag}: ${String(e)}`);
      console.log(`  ERROR ${tag}: ${String(e)}`);
      try { await page.evaluate(() => { location.hash = '#/?view=browse'; }); } catch { /* ignore */ }
    }
  }
// ---------- 4) construction section specifically (real approved services) ----------
  await page.evaluate(() => { location.hash = '#/category/construction'; });
  await page.waitForFunction(() => location.hash.includes('/category/construction'), { timeout: 30000 });
  const constructionServices = truth.filter((s) =>
    ['construction-decor', 'construction-plumbing', 'construction'].includes(s.category || ''));
  let constructionVisibleCount = 0;
  for (const s of constructionServices) {
    const state = await waitForTitleInSection(s.title, 20000);
    if (state === 'visible') constructionVisibleCount++;
  }
  push(constructionVisibleCount === constructionServices.length,
    `البناء والإنشاءات shows ${constructionVisibleCount}/${constructionServices.length} approved services`);
  results.checks.push(`construction approved ids: ${constructionServices.map((s) => s.id).join(', ')}`);

  // ---------- refresh the construction section too ----------
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => location.hash.includes('/category/construction'), { timeout: 30000 });
  let constructionAfterReloadOk = true;
  for (const s of constructionServices) {
    const state = await waitForTitleInSection(s.title, 20000);
    if (state !== 'visible') constructionAfterReloadOk = false;
  }
  push(constructionAfterReloadOk, 'البناء والإنشاءات keeps its services after Refresh');

  console.log(summaryPlain(results));
  await writeFile('scripts/category-ui-test-result.json', JSON.stringify(results, null, 2), 'utf8');
  const fatal = results.missingWithinSection.length > 0 || results.refreshFailures.length > 0 || pageErrors.length > 0;
  if (fatal) process.exitCode = 1;
} finally {
  await browser.close();
}

function summaryPlain(r) {
  const lines = [];
  lines.push(`IN_FEED=${r.shownInFeed.length}/${r.approvedTotal}`);
  lines.push(`ENTERED_SECTIONS=${r.enteredSections.length}`);
  lines.push(`MISSING_IN_SECTION=${r.missingWithinSection.length}`);
  lines.push(`REFRESH_FAILURES=${r.refreshFailures.length}`);
  const fails = r.checks.filter((c) => c.startsWith('FAIL'));
  lines.push(`CHECK_SUMMARY=${r.checks.length - fails.length} pass / ${fails.length} fail`);
  lines.push(`PAGE_ERRORS=${pageErrors.length}`);
  for (const c of r.checks) if (c.startsWith('FAIL')) lines.push(`  FAIL-CHECK: ${c}`);
  for (const m of r.missingWithinSection) lines.push(`  MISSING: ${m}`);
  for (const f of r.refreshFailures) lines.push(`  REFRESH: ${f}`);
  for (const [i, e] of r.errors.entries()) lines.push(`  ERROR#${i + 1}: ${e}`);
  return lines.join('\n');
}