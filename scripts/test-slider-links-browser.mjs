// Real editor, save hook, Home mapping and slider. SDK/storage fixtures only;
// no production Auth, PIN, Supabase writes or existing rows are used.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = await readFile(path.join(root, 'src/pages/Home.tsx'), 'utf8');
const pipeline = home.slice(home.indexOf('  const { ads, loading: sliderLoading } = useSlider();'), home.indexOf('  // Scroll Restoration'));
assert.ok(pipeline.includes('facebook_url: ad.facebook_url'), 'Exercise the actual Home link mapping');
const image = await readFile(path.join(root, 'public/slider-banners/services/service-01.jpg'));
const cssFile = (await readdir(path.join(root,'dist/assets'))).find(name=>name.startsWith('index-')&&name.endsWith('.css'));
assert.ok(cssFile,'Build the app before testing the real Production stylesheet');
const css = (await readFile(path.join(root,'dist/assets',cssFile),'utf8')).replace(/@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')[^;]*;/g, '');

const sdk = `
const seed=[{id:1,title:'Legacy slider',images:['/fixture.jpg'],url:'/fixture.jpg',is_active:true,sort_order:1,display_date:null,start_time:null,end_time:null}];
window.fixtureAudit={inserts:[],updates:[],reads:[]};
const read=()=>JSON.parse(localStorage.getItem('slider-link-fixture-rows')||JSON.stringify(seed));
const save=rows=>localStorage.setItem('slider-link-fixture-rows',JSON.stringify(rows));
export function createClient(){return {
auth:{getSession:async()=>({data:{session:{access_token:'isolated-upload-fixture'}},error:null})},
from(name){if(name!=='slider_images')throw Error('Unexpected table '+name);let payload,kind='read',id;
 const query={select(columns){if(columns)window.fixtureAudit.reads.push(columns);return query},order(){return query},
 insert(values){payload=values[0];kind='insert';return query},update(values){payload=values;kind='update';return query},delete(){kind='delete';return query},eq(_key,value){id=value;return query},single(){return query},maybeSingle(){return query},
 then(resolve,reject){return Promise.resolve().then(()=>{let rows=read();
 if(kind==='read')return {data:rows.sort((a,b)=>a.sort_order-b.sort_order),error:null};
 if(kind==='delete'){save(rows.filter(r=>r.id!==id));return {data:null,error:null}}
 // Match the real schema: only the six link columns were added, not design columns.
 if('subtitle' in payload)return {data:null,error:{code:'PGRST204',message:'Could not find subtitle column'}};
 if(kind==='insert'){const row={...payload,id:2};rows.push(row);save(rows);window.fixtureAudit.inserts.push(payload);return {data:row,error:null}}
 const row={...rows.find(r=>r.id===id),...payload};rows=rows.map(r=>r.id===id?row:r);save(rows);window.fixtureAudit.updates.push(payload);return {data:row,error:null};
 }).then(resolve,reject)}};return query}
};}
`;
const entry = `
import React,{useState,useEffect,useMemo} from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
import Manager from './src/components/SliderManager';import ToastProvider from './src/components/ToastProvider';import ContentSlider from './src/components/ContentSlider';
import {useSlider,getAdStatus} from './src/hooks/useSlider';import {sanitizeSliderLink} from './src/lib/sliderLinks';import {buildServiceContentSlides,DEMO_SERVICE_SLIDES,SLIDER_DEMO_MODE} from './src/lib/contentSlides';
import {compareSliderOrder,getSliderImageUrl} from './src/lib/sliderPresentation';import {Capacitor} from '@capacitor/core';Capacitor.isNativePlatform=()=>window.fixtureNative===true;
import LinkActions from './src/components/SliderLinkActions';
function Public(){const publicServices=[];const categories=[];${pipeline}
useEffect(()=>{window.fixtureIds=contentSlides.map(s=>s.id)},[contentSlides]);return <ContentSlider slides={contentSlides} autoplay={false} label="Fixture" testId="fixture-slider" imageFit="contain"/>}
function App(){const actions=useSlider();useEffect(()=>{window.fixtureActions=actions},[actions]);const [mode,setMode]=useState(location.hash==='#public'?'public':'admin');const [linkCase,setLinkCase]=useState(null);useEffect(()=>{window.fixtureSetLinkCase=setLinkCase},[]);return <BrowserRouter><ToastProvider>
<button data-nav onClick={()=>{const next=mode==='admin'?'public':'admin';location.hash=next;setMode(next)}}>Switch</button>
<main style={{maxWidth:1024,margin:'20px auto'}}>{mode==='admin'?<Manager/>:<Public/>}</main>{linkCase&&<div data-link-case><LinkActions links={linkCase}/></div>}</ToastProvider></BrowserRouter>}
createRoot(document.getElementById('root')).render(<App/>);
`;
let origin;
const server = createServer((req, res) => {
  if (req.url === '/test.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text); }
  else if (req.url === '/test.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
  else if (req.url.split('?')[0] === '/fixture.jpg' || req.url.startsWith('/storage/v1/object/public/')) { res.setHeader('Content-Type', 'image/jpeg'); res.end(image); }
  else if (req.method === 'POST' && req.url.startsWith('/storage/v1/object/')) { res.setHeader('Content-Type', 'application/json'); res.end('{}'); }
  else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<html data-theme="light"><link rel="stylesheet" href="/test.css"><div id="root"></div><script src="/test.js"></script></html>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
origin = `http://127.0.0.1:${server.address().port}`;
const bundle = await build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',
  define:{'process.env.NODE_ENV':'"production"','import.meta.env':JSON.stringify({BASE_URL:'/',VITE_SUPABASE_URL:origin,VITE_SUPABASE_ANON_KEY:'isolated-fixture'})},
  plugins:[{name:'isolated-sdk',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'sdk',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:sdk,loader:'js'}));}}]});
let browser;
try {
  browser = await puppeteer.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,defaultViewport:{width:1440,height:1000}});
  const page = await browser.newPage(); await page.emulateTimezone('UTC'); const errors=[]; const remoteRequests=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request',request=>{if(request.url().startsWith(origin)||request.url().startsWith('data:'))void request.continue();else{remoteRequests.push(request.url());void request.abort();}});
  const clickText = async text => {
    await page.waitForFunction(value=>[...document.querySelectorAll('button')].some(b=>!b.disabled&&(b.textContent.trim()===value||[...b.querySelectorAll('span')].some(s=>s.textContent.trim()===value))),{},text);
    await page.evaluate(value=>[...document.querySelectorAll('button')].find(b=>!b.disabled&&(b.textContent.trim()===value||[...b.querySelectorAll('span')].some(s=>s.textContent.trim()===value))).click(),text);
  };
  const fill = async (label,value) => {
    const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('span')].find(s=>s.textContent.trim()===text)?.parentElement.querySelector('input'),label);
    const input=handle.asElement();assert.ok(input,'Input: '+label);await input.focus();await page.keyboard.down('Control');await page.keyboard.press('A');await page.keyboard.up('Control');await page.keyboard.press('Backspace');if(value)await input.type(value);assert.equal(await input.evaluate(node=>node.value),value,'Actual input value: '+label);await handle.dispose();
  };
  const selectSlide=async id=>{const dot=await page.evaluate(value=>window.fixtureIds.indexOf(value)+1,id);assert.ok(dot>0);await page.evaluate(n=>document.querySelector('[data-testid="fixture-slider"] button[aria-label^="الشريحة '+n+' من"]').click(),dot);await page.waitForFunction(value=>{const node=document.querySelector('[data-slide-id="'+value+'"]');return node&&getComputedStyle(node).opacity==='1'}, {}, id);};
  await page.goto(origin,{waitUntil:'networkidle0'});
  await clickText('إضافة شريحة جديدة');
  await fill('العنوان الرئيسي','New linked slider');await fill('نص الزر','Visit WISAL');await fill('رابط الزر',origin+'/destination');
  for(const label of ['Facebook','Instagram','TikTok','X / Twitter'])await fill(label,origin+'/social/'+encodeURIComponent(label));
  await (await page.$('input[type="file"]')).uploadFile(path.join(root,'public/slider-banners/services/service-01.jpg'));
  await page.waitForFunction(()=>[...document.querySelectorAll('[role="status"]')].some(e=>e.textContent.includes('تم رفع الصورة')));
  await clickText('حفظ الشريحة');await page.waitForFunction(()=>window.fixtureAudit.inserts.length===1);
  const inserted=await page.evaluate(()=>window.fixtureAudit.inserts[0]);
  for(const field of ['button_text','button_link','facebook_url','instagram_url','tiktok_url','twitter_url'])assert.ok(inserted[field],field+' saved after design fallback');
  await page.click('[data-nav]');await page.waitForFunction(()=>window.fixtureIds?.includes('2'));
  assert.equal(await page.$eval('[data-testid="fixture-slider"]',node=>getComputedStyle(node).position),'relative','Real Production CSS is active');
  assert.deepEqual((await page.evaluate(()=>window.fixtureIds)).slice(0,2),['1','2']);
  assert.equal(await page.$('[data-slider-links]'),null,'Legacy slide has no blank buttons');
  await selectSlide('2');await page.waitForSelector('[data-slider-links]');
  assert.equal(await page.$$eval('[data-slider-links] a',nodes=>nodes.length),5);
  for(const label of ['Facebook','Instagram','TikTok','X / Twitter']) {
    assert.equal(await page.$eval('[data-slider-links] a[aria-label="'+label+'"]',node=>node.getAttribute('href')),origin+'/social/'+encodeURIComponent(label));
  }
  assert.equal(await page.$eval('[data-slider-links] a',node=>node.textContent),'Visit WISAL');
  const frame=await page.$eval('[data-testid="fixture-slider"]',node=>node.getBoundingClientRect().toJSON());
  const targetPromise=browser.waitForTarget(target=>target.url()===origin+'/destination');await page.click('[data-slider-links] a');const popup=await (await targetPromise).page();assert.ok(popup);await popup.close();
  await page.evaluate(()=>{window.fixtureNative=true});await page.waitForFunction(()=>document.querySelector('[data-slider-links]'));
  // Render the native branch after a slide change; external navigation uses _self.
  await selectSlide('1');await selectSlide('2');
  assert.equal(await page.$eval('[data-slider-links] a',node=>node.target),'_self');
  await page.evaluate(()=>{window.fixtureNative=false});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-testid="fixture-slider"] h1')).opacity==='1'&&document.querySelector('[data-slide-id="2"] img')?.naturalWidth>0);
  await page.screenshot({path:path.join(root,'slider-links-desktop.png')});
  await page.setViewport({width:390,height:844});
  const mobile=await page.$eval('[data-slider-links]',node=>node.getBoundingClientRect().toJSON());
  assert.ok(mobile.left>=0&&mobile.right<=390,'Mobile links fit inside slider');
  const title=await page.$eval('[data-testid="fixture-slider"] h1',node=>node.getBoundingClientRect().toJSON());assert.ok(mobile.bottom<title.top,'Links do not cover title: '+JSON.stringify({mobile,title}));
  await page.screenshot({path:path.join(root,'slider-links-mobile.png')});
  await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>window.fixtureIds?.includes('2'));await selectSlide('2');assert.equal(await page.$$eval('[data-slider-links] a',nodes=>nodes.length),5);
  await page.setViewport({width:1440,height:1000});await page.click('[data-nav]');
  await clickText('استعراض الشرائح');await page.waitForSelector('button[title="تعديل الشريحة"]');
  await page.evaluate(()=>[...document.querySelectorAll('button[title="تعديل الشريحة"]')].at(-1).click());
  await page.waitForSelector('input[placeholder="خدمات احترافية بجودة عالية"]');
  await fill('نص الزر','Updated link');await fill('Instagram','');await fill('X / Twitter','');
  await clickText('حفظ التغييرات');await page.waitForFunction(()=>window.fixtureAudit.updates.length===1);
  assert.equal(await page.evaluate(()=>window.fixtureAudit.updates[0].instagram_url),null,'Instagram clearing is persisted');
  assert.equal(await page.evaluate(()=>window.fixtureAudit.updates[0].twitter_url),null,'Twitter clearing is persisted');
  await page.click('[data-nav]');await page.waitForFunction(()=>window.fixtureIds?.includes('2'));await selectSlide('2');
  await page.waitForFunction(()=>document.querySelector('[data-slider-links] a')?.textContent==='Updated link'&&document.querySelectorAll('[data-slider-links] a').length===3);
  assert.equal(await page.$$eval('[data-slider-links] a',nodes=>nodes.length),3);assert.equal(await page.$('[data-slider-links] a[aria-label="Instagram"]'),null);assert.equal(await page.$('[data-slider-links] a[aria-label="X / Twitter"]'),null);
  assert.equal(await page.$eval('[data-slider-links] a',node=>node.textContent),'Updated link');
  for(const links of [{button_text:'Name only'},{button_link:origin+'/url-only'},{button_text:'Unsafe',button_link:'javascript:alert(1)',facebook_url:'data:text/html,evil'}]) {
    await page.evaluate(value=>window.fixtureSetLinkCase(value),links);
    await page.waitForSelector('[data-link-case]');
    await page.waitForFunction(()=>document.querySelector('[data-link-case]').querySelectorAll('a').length===0);
  }
  await page.evaluate(value=>window.fixtureSetLinkCase(value),{facebook_url:origin+'/fb',tiktok_url:origin+'/tk'});
  await page.waitForFunction(()=>document.querySelector('[data-link-case]').querySelectorAll('a').length===2);
  assert.deepEqual(await page.$$eval('[data-link-case] a',nodes=>nodes.map(node=>node.getAttribute('aria-label'))),['Facebook','TikTok']);
  const previousImage=await page.$eval('[data-slide-id="2"]',node=>node.dataset.sliderImageUrl);
  await page.evaluate(()=>window.fixtureActions.updateAd(2,{images:['/fixture.jpg?changed=1']}));
  await page.waitForFunction(()=>document.querySelector('[data-slide-id="2"]')?.dataset.sliderImageUrl.includes('changed=1'));
  assert.notEqual(await page.$eval('[data-slide-id="2"]',node=>node.dataset.sliderImageUrl),previousImage,'Image edits propagate between mounted hook consumers');
  await page.evaluate(()=>window.fixtureActions.toggleAdActive(2,true));
  await page.waitForFunction(()=>window.fixtureIds.length===1&&window.fixtureIds[0]==='1');
  await page.evaluate(()=>window.fixtureActions.toggleAdActive(2,false));
  await page.waitForFunction(()=>window.fixtureIds.includes('2'));
  await page.evaluate(()=>window.fixtureActions.deleteAd(2));
  await page.waitForFunction(()=>window.fixtureIds.length===1&&window.fixtureIds[0]==='1');
  assert.deepEqual(errors,[]);assert.deepEqual(remoteRequests,[]);
  const report={button_text:'PASS',button_link:'PASS',facebook:'PASS',instagram:'PASS',tiktok:'PASS',twitter:'PASS',save:'PASS',update:'PASS',imageUpdate:'PASS',disable:'PASS',delete:'PASS',read:'PASS',display:'PASS',emptyAndLegacy:'PASS',unsafeLinks:'BLOCKED',refresh:'PASS',mobile:'PASS',desktop:'PASS',webClick:'PASS',nativeAnchor:'PASS (simulated platform; native device not connected)',frame,isolated:true,errors};
  await writeFile(path.join(root,'slider-links-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally { if(browser)await browser.close();await new Promise(resolve=>server.close(resolve)); }
