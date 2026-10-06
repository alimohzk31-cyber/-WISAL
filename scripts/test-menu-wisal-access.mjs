import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import puppeteer from 'puppeteer-core';

const root = process.cwd();
const fixturePin = '731946'; // Synthetic test fixture; never sent to a real server.
const sessionKey = 'wisal-menu-synthetic-session';
// Reuse the existing SDK-boundary mock, while testing the actual Layout, menu,
// AuthProvider, PIN helper and protected route together.
const existingTest = fs.readFileSync('scripts/test-admin-route.mjs', 'utf8');
const mock = existingTest.match(/const mock = `([\s\S]*?)`;/)[1]
  .replaceAll('${JSON.stringify(sessionKey)}', JSON.stringify(sessionKey))
  .replaceAll('${JSON.stringify(fixturePin)}', JSON.stringify(fixturePin));
const entry = `
import React,{useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter,Routes,Route} from 'react-router-dom';
import {AuthProvider,useAuth} from './src/context/AuthContext';
import {LanguageProvider} from './src/context/LanguageContext';
import {ThemeProvider} from './src/context/ThemeContext';
import Layout from './src/components/Layout';
import AdminRoute from './src/components/AdminRoute';
function Status(){const auth=useAuth();useEffect(()=>{window.audit.auth={loading:auth.loading,fresh:auth.hasFreshPinVerification};},[auth.loading,auth.hasFreshPinVerification]);return null;}
function Dashboard(){useEffect(()=>{window.audit.mounts++;},[]);return <div data-admin>Protected dashboard</div>;}
createRoot(document.getElementById('root')).render(<ThemeProvider><LanguageProvider><AuthProvider><Status/><HashRouter><Routes><Route element={<Layout/>}><Route path='/' element={<div data-public>Public</div>}/><Route element={<AdminRoute/>}><Route path='admin' element={<Dashboard/>}/></Route></Route></Routes></HashRouter></AuthProvider></LanguageProvider></ThemeProvider>);
`;
const bundle = await build({
  stdin:{contents:entry,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',
  loader:{'.png':'dataurl','.jpg':'dataurl','.webp':'dataurl','.woff2':'dataurl'},
  outdir:'test',define:{'process.env.NODE_ENV':'"production"','import.meta.env':JSON.stringify({BASE_URL:'/',VITE_SUPABASE_ANON_KEY:'synthetic-publishable-key'})},
  plugins:[{name:'synthetic-boundaries',setup(b){
    b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'sdk',namespace:'audit'}));
    b.onResolve({filter:/\/hooks\/use(Stats|Notifications)$/},args=>({path:args.path,namespace:'hooks'}));
    b.onLoad({filter:/.*/,namespace:'audit'},()=>({contents:mock,loader:'js'}));
    b.onLoad({filter:/.*/,namespace:'hooks'},()=>({contents:'export function useStats(){return {incrementVisits(){}};} export function useNotifications(){return {unreadCount:0,notifications:[],loading:false,markAllRead(){},markRead(){}};}',loader:'js'}));
  }}],
});
const server=createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.url==='/test.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles.find(file=>file.path.endsWith('.js')).contents);}
  else if(req.url==='/test.css'){res.setHeader('Content-Type','text/css');res.end(fs.readFileSync(path.join(root,'dist/assets',fs.readdirSync('dist/assets').find(file=>/^index-.*\.css$/.test(file)))));}
  else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<link rel="stylesheet" href="/test.css"><div id="root"></div><script>window.auditConfig={}</script><script src="/test.js"></script>');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
fs.mkdirSync('.cache/menu-wisal-access',{recursive:true});
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  for(const width of [390,1280]){
    const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.setViewport({width,height:900});await page.setRequestInterception(true);
    page.on('request',request=>{if(new URL(request.url()).origin===origin||request.url().startsWith('data:'))void request.continue();else void request.abort();});
    await page.goto(origin+'/#/');await page.waitForFunction(()=>window.audit?.auth?.loading===false);
    const original=await page.evaluate(()=>{const img=document.querySelector('header img');return {src:img.src,rect:JSON.stringify(img.getBoundingClientRect()),className:img.className};});
    await page.evaluate(()=>{const button=document.querySelector('header img').closest('button');for(let i=0;i<5;i++)button.click();});
    assert.equal(await page.$('input[type="password"]'),null);assert.equal(await page.evaluate(()=>window.audit.pinCalls),0);
    await page.click('button[aria-controls="main-menu"]');await page.waitForSelector('#main-menu button[aria-label="WISAL"]');
    await page.waitForFunction(()=>{const img=document.querySelector('#main-menu button[aria-label="WISAL"] img');return img?.complete&&img.naturalWidth>0;});
    assert.notEqual(await page.$eval('#main-menu button[aria-label="WISAL"] img',img=>img.src),original.src);
    const banner=await page.$eval('#main-menu button[aria-label="WISAL"] img',img=>{const r=img.getBoundingClientRect(),menu=document.querySelector('#main-menu');return{width:r.width,height:r.height,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,fit:getComputedStyle(img).objectFit,first:menu.firstElementChild.contains(img),count:menu.querySelectorAll('button[aria-label="WISAL"]').length};});
    assert.equal(banner.naturalWidth,1672);assert.equal(banner.naturalHeight,941);assert.equal(banner.fit,'contain');assert.ok(Math.abs(banner.width/banner.height-1672/941)<0.01);assert.ok(banner.width>200);assert.equal(banner.first,true);assert.equal(banner.count,1);
    const phrase='وصال | كل الخدمات في مكان واحد';
    const taps=async count=>{await page.evaluate(count=>{const button=document.querySelector('#main-menu button[aria-label="WISAL"]');for(let i=0;i<count;i++)button.click();},count);};
    const shown=()=>page.waitForFunction(phrase=>document.querySelector('#main-menu')?.innerText.includes(phrase),{},phrase);
    const hidden=()=>page.waitForFunction(phrase=>!document.querySelector('#main-menu')?.innerText.includes(phrase),{},phrase);
    await taps(4);assert.equal(await page.evaluate(phrase=>document.body.innerText.includes(phrase),phrase),false);await taps(1);await shown();
    assert.equal(await page.$('#main-menu input, #main-menu textarea, [role="dialog"]'),null);
    await page.keyboard.type('000000');await hidden();assert.equal(await page.evaluate(()=>window.audit.pinCalls),1);assert.equal(await page.$('[data-admin]'),null);
    await taps(5);await shown();await page.keyboard.type('731');assert.equal(await page.evaluate(()=>document.body.innerText.includes('731')),false);
    await new Promise(resolve=>setTimeout(resolve,10_200));await hidden();assert.equal(await page.evaluate(()=>window.audit.pinCalls),1);
    await taps(5);await shown();await page.keyboard.type('731');await page.click('button[aria-controls="main-menu"]');await page.waitForFunction(()=>!document.querySelector('#main-menu'));
    await page.keyboard.type('946');assert.equal(await page.evaluate(()=>window.audit.pinCalls),1);
    await page.click('button[aria-controls="main-menu"]');await page.waitForSelector('#main-menu button[aria-label="WISAL"]');
    // A pause breaks the consecutive-tap sequence.
    await taps(3);await new Promise(resolve=>setTimeout(resolve,2100));await taps(2);assert.equal(await page.evaluate(phrase=>document.body.innerText.includes(phrase),phrase),false);await taps(3);await shown();
    await page.screenshot({path:`.cache/menu-wisal-access/${width}-armed.png`});
    const unchanged=await page.evaluate(()=>{const img=document.querySelector('header img');return {src:img.src,rect:JSON.stringify(img.getBoundingClientRect()),className:img.className};});assert.deepEqual(unchanged,original);
    await page.keyboard.type('7319');await page.keyboard.press('Backspace');await page.keyboard.type('946');await page.waitForSelector('[data-admin]');
    assert.equal(await page.evaluate(()=>location.hash),'#/admin');assert.equal(await page.evaluate(()=>window.audit.pinCalls),2);assert.equal(await page.evaluate(()=>window.audit.auth.fresh),true);
    assert.equal(await page.$('input[type="password"]'),null);assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px: original logo unchanged/non-admin; original rectangular banner at menu top without crop; five consecutive taps; phrase only; no input/modal/PIN in DOM; wrong PIN silent; 10s timeout; close clears input; correct PIN uses existing admin-login and protected route`);
    await page.close();
  }
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
