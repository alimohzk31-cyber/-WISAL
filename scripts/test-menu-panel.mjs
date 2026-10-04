import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const back = '[role="dialog"] button[aria-label="\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629"]';
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }, { width: 320, height: 568 }]) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto(process.env.WISAL_UI_BASE || 'http://localhost:3100', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[aria-controls="main-menu"]');
    await page.click('[aria-controls="main-menu"]');
    await page.waitForSelector('#main-menu');
    let anchor;
    for (const [section, selector, large] of [['NOTIFICATIONS', '[data-wisal-submenu-trigger]', true], ['SUGGESTIONS', '#main-menu button:nth-child(2)', true], ['COLORS', '[data-wisal-colors-trigger]', false], ['VERSIONS', '[data-wisal-version-trigger]', false]]) {
      await page.click(selector);
      await page.waitForSelector('[role="dialog"]');
      await new Promise(resolve => setTimeout(resolve, 350));
      const state = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const rect = dialog.getBoundingClientRect();
        return { count: document.querySelectorAll('[role="dialog"]').length, main: !!document.querySelector('#main-menu'), x: rect.x, y: rect.y, width: rect.width, height: rect.height, inside: rect.x >= 0 && rect.right <= innerWidth && rect.y >= 0 && rect.bottom <= innerHeight, scroll: [...dialog.querySelectorAll('*')].some(element => getComputedStyle(element).overflowY === 'auto'), footer: !dialog.querySelector('form') || dialog.querySelector('form').getBoundingClientRect().bottom <= rect.bottom };
      });
      assert.equal(state.count, 1); assert.equal(state.main, false); assert(state.inside);
      assert(large ? state.height > 300 : state.height <= 282);
      if (large) assert(state.scroll);
      assert(state.footer);
      anchor ??= { x: state.x, y: state.y };
      assert.equal(state.x, anchor.x); assert.equal(state.y, anchor.y);
      if (section === 'SUGGESTIONS') {
        await page.evaluate(() => document.querySelector('[role="dialog"] .border-b button:nth-child(2)').click());
        assert(await page.evaluate(() => { const dialog = document.querySelector('[role="dialog"]'); const button = dialog.querySelector('button[type="submit"]'); return button.getBoundingClientRect().bottom <= dialog.getBoundingClientRect().bottom && getComputedStyle(button.parentElement).flexShrink === '0'; }));
      }
      await page.click(back); await page.waitForSelector('#main-menu'); assert.equal(await page.$('[role="dialog"]'), null);
      console.log(`${viewport.width} ${section} ${large ? 'LARGE' : 'COMPACT'}: PASS (${state.width}x${state.height})`);
    }
    console.log(`${viewport.width} NO OVERLAP / BACK NAVIGATION: PASS`);
    await page.close();
  }
} finally { await browser.close(); }
