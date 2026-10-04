import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const report = [];
const base = process.env.WISAL_UI_BASE || 'http://localhost:3100';
try {
for (const viewport of [{width:390,height:844},{width:320,height:568},{width:1366,height:768}].filter(v=>!process.env.TEST_WIDTH||v.width===Number(process.env.TEST_WIDTH))) for (const theme of ['light','royal'].filter(t=>!process.env.TEST_THEME||t===process.env.TEST_THEME)) {
 const page=await browser.newPage(); await page.setViewport(viewport);
 await page.evaluateOnNewDocument(theme=>localStorage.setItem('saleen_app_theme',theme),theme);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='\u0627\u0644\u0642\u0633\u0645'),{timeout:60000});
 async function arm(){await page.evaluate(()=>{window.routeFrames=[];window.routeObserver?.disconnect();window.routeObserver=new MutationObserver(()=>{if(!location.hash.includes('/category/')||!document.querySelector('main section.isolate h1'))return;const committedOutlet=document.querySelector('main').firstElementChild, committedHeading=document.querySelector('main section.isolate h1'), hash=location.hash;const capture=()=>{const main=document.querySelector('main'),outlet=main.firstElementChild;if(outlet!==committedOutlet||!committedHeading.isConnected||location.hash!==hash)return;const r=outlet.getBoundingClientRect();routeFrames.push({y:document.scrollingElement.scrollTop,top:r.top,count:main.children.length,opacity:getComputedStyle(outlet).opacity,heading:main.querySelector('section.isolate h1')?.textContent});};capture();requestAnimationFrame(capture)});routeObserver.observe(document.querySelector('main'),{childList:true,subtree:true});})}
 async function check(label){await page.waitForFunction(()=>location.hash.includes('/category/')&&!!document.querySelector('main section.isolate h1')&&window.routeFrames?.length>0);const result=await page.evaluate(()=>({frames:routeFrames,scroll:document.scrollingElement.tagName,y:document.scrollingElement.scrollTop,heading:document.querySelector('main section.isolate h1').textContent,children:document.querySelector('main').children.length,theme:document.documentElement.dataset.theme}));assert(result.frames.length>0,label+' no commit samples'); if(result.frames.some(f=>f.y!==0)) console.log('FAILED FRAMES',JSON.stringify(result));for(const frame of result.frames){assert.equal(frame.y,0,label+' scroll');assert.equal(frame.count,1,label+' duplicate outlets');assert.equal(Number(frame.opacity),1,label+' hidden outlet');assert(frame.top>=0&&frame.top<innerHeightSafe(viewport),label+' outside viewport')}assert.equal(result.theme,theme);report.push({viewport,theme,label,...result});console.log(viewport.width,theme,label,'PASS');}
 function innerHeightSafe(v){return v.height}
 await arm();await page.evaluate(()=>{window.scrollTo(0,1500);[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='\u0627\u0644\u0642\u0633\u0645').click()});await check('BROWSE CARD -> DOCTORS');
 for(const slug of ['doctors','shipping-delivery','pharmacies','cars']) {
  await page.evaluate(()=>{location.hash='/?view=services'});await page.waitForSelector(`a[href="#/category/${slug}"]`);
  await arm();await page.evaluate(slug=>{window.scrollTo(0,500);document.querySelector(`a[href="#/category/${slug}"]`).click()},slug);await check('HOME -> '+slug);
  await page.evaluate(()=>{location.hash='/?view=services'});await page.waitForSelector(`a[href="#/category/${slug}"]`);await arm();await page.goBack();await check('BACK -> '+slug);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!document.querySelector('main section.isolate h1'));
  assert.equal(await page.evaluate(()=>document.scrollingElement.scrollTop),0);assert.equal(await page.evaluate(()=>document.querySelector('main').children.length),1);console.log(viewport.width,theme,'REFRESH '+slug,'PASS');
 }
 assert.equal(errors.length,0,errors.join('\n'));await page.screenshot({path:`section-${viewport.width}-${theme}.png`});await page.close();
}
await writeFile('section-navigation-report.json',JSON.stringify(report,null,2));
}finally{await browser.close()}
