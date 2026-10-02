// Read-only comparison of the real remote rows in both actual UI components.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer-core';

const env=dotenv.parse(await readFile('.env'));
const home=await readFile('src/pages/Home.tsx','utf8');
const pipeline=home.slice(home.indexOf('  const { ads, loading: sliderLoading } = useSlider();'),home.indexOf('  // Scroll Restoration'));
assert.ok(pipeline.includes('sliderId: ad.id'));
const entry=`import React,{useState,useMemo,useEffect} from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
import Manager from './src/components/SliderManager';import ToastProvider from './src/components/ToastProvider';import ContentSlider from './src/components/ContentSlider';
import {useSlider,getAdStatus} from './src/hooks/useSlider';import {compareSliderOrder,getSliderImageUrl} from './src/lib/sliderPresentation';import {sanitizeSliderLink} from './src/lib/sliderLinks';
function Browse(){${pipeline} useEffect(()=>{window.liveRows=ads.map(ad=>({id:ad.id,source:ad.images[0]||ad.url,sort_order:ad.sort_order,is_active:ad.is_active,display_date:ad.display_date,start_time:ad.start_time,end_time:ad.end_time,status:getAdStatus(ad)}));window.liveSlides=contentSlides},[ads,contentSlides]);return <ContentSlider slides={contentSlides} autoplay={false} label="Live comparison" testId="live-slider"/>}
function App(){const[admin,setAdmin]=useState(true);return <BrowserRouter><ToastProvider><button id="switch" onClick={()=>setAdmin(!admin)}>Compare</button>{admin?<Manager/>:<Browse/>}</ToastProvider></BrowserRouter>}createRoot(document.getElementById('root')).render(<App/>);`;
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"production"','import.meta.env':JSON.stringify({BASE_URL:'/',VITE_SUPABASE_URL:env.VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY:env.VITE_SUPABASE_ANON_KEY})}});
const cssName=(await readdir('dist/assets')).find(n=>/^index-.*\.css$/.test(n));const css=(await readFile('dist/assets/'+cssName,'utf8')).replace(/@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')[^;]*;/g,'');
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/test.js'?'text/javascript':req.url==='/test.css'?'text/css':'text/html; charset=utf-8');res.end(req.url==='/test.js'?bundle.outputFiles[0].text:req.url==='/test.css'?css:'<html data-theme="light"><link rel="stylesheet" href="/test.css"><div id="root"></div><script src="/test.js"></script></html>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,defaultViewport:{width:1440,height:1000}});
try{const page=await browser.newPage();page.on("pageerror",e=>console.log("PAGEERROR",e.message));page.on("console",m=>{if(m.type()==="error")console.log("CONSOLE",m.text())});const requests=[];page.on('response',response=>{if(response.url().includes('/rest/v1/slider_images'))requests.push({status:response.status(),url:response.url()})});await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('استعراض الشرائح')),{timeout:30000});await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes('استعراض الشرائح')).click());await page.waitForSelector('[data-slider-id]');
 const admin=await page.$$eval('[data-slider-id]',nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.sliderId,n.dataset.sliderImageUrl])));
 await page.click('#switch');await page.waitForFunction(()=>window.liveSlides?.length>0);const slides=await page.evaluate(()=>window.liveSlides);const rows=await page.evaluate(()=>window.liveRows);
 const comparison=[];for(let index=0;index<slides.length;index++){const slide=slides[index];await page.evaluate(n=>document.querySelectorAll('[data-testid="live-slider"] button[aria-label^="الشريحة "]')[n].click(),index);await page.waitForSelector('[data-slide-id="'+slide.id+'"]');const browse=await page.$eval('[data-slide-id="'+slide.id+'"]',n=>n.dataset.sliderImageUrl);assert.equal(browse,admin[slide.id]);comparison.push({id:slide.sliderId,adminImageUrl:admin[slide.id],browseImageUrl:browse,match:'MATCH'});}
 await page.screenshot({path:'slider-live-match.png'});await page.reload({waitUntil:'networkidle2'});await page.click('#switch');await page.waitForFunction(()=>window.liveSlides?.length>0);assert.deepEqual(await page.evaluate(()=>window.liveSlides.map(s=>s.id)),slides.map(s=>s.id));
 // Also inspect the actual built Home route, rather than only its extracted mapping.
 await page.goto('http://localhost:4173/?view=services',{waitUntil:'networkidle2'});
 await page.waitForSelector('[data-testid="services-slider"] [data-slider-id]',{timeout:30000});
 for(let index=0;index<comparison.length;index++){
   const expected=comparison[index];
   await page.evaluate(n=>document.querySelectorAll('[data-testid="services-slider"] button[aria-label^="الشريحة "]')[n].click(),index);
   await page.waitForFunction(id=>document.querySelector('[data-testid="services-slider"] [data-slider-id="'+id+'"] img[data-slide-layer="foreground"]')?.naturalWidth>0,{},expected.id);
   const actual=await page.$eval('[data-testid="services-slider"] [data-slider-id="'+expected.id+'"] img[data-slide-layer="foreground"]',n=>n.currentSrc);
   assert.equal(actual,expected.adminImageUrl,'Actual Production Home uses the same loaded image');
 }
 await page.screenshot({path:'slider-production-match.png'});
 const report={remote:'READ ONLY',requests,rows,comparison,productionHome:'PASS',loadedImages:'PASS',refresh:'PASS'};await writeFile('slider-live-match-report.json',JSON.stringify(report,null,2));await writeFile('slider-live-match-report.md','| Slider ID | Admin image URL | Browse image URL | Match |\n|---|---|---|---|\n'+comparison.map(r=>`| ${r.id} | ${r.adminImageUrl} | ${r.browseImageUrl} | MATCH |`).join('\n'));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
