import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import puppeteer from 'puppeteer-core';

// Real form, field configuration, validation, image optimization and modal.
// Only the service-save boundary and category source are simulated: no remote writes.
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';
import AddServiceModal from './src/components/AddServiceModal';
import {LanguageProvider} from './src/context/LanguageContext';
import {ThemeProvider} from './src/context/ThemeContext';
import ToastProvider from './src/components/ToastProvider';
const root=createRoot(document.getElementById('root'));let sequence=0;
window.showForm=options=>{window.formOptions=options;root.render(<ThemeProvider><LanguageProvider><ToastProvider><AddServiceModal key={++sequence} {...options} onClose={()=>window.audit.closes++}/></ToastProvider></LanguageProvider></ThemeProvider>);};
window.showForm(window.formOptions);
`;
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},plugins:[{name:'local-boundaries',setup(b){
  b.onResolve({filter:/\/context\/ServicesContext$/},()=>({path:'services',namespace:'test'}));
  b.onResolve({filter:/\/hooks\/useCategories$/},()=>({path:'categories',namespace:'test'}));
  b.onResolve({filter:/\/lib\/supabase$/},()=>({path:'supabase',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},args=>({loader:'js',contents:args.path==='services'?`export function useServices(){return {addService:async payload=>{window.audit.saves.push(payload);}};}export function getOwnerId(){return 'synthetic-owner';}`:args.path==='categories'?`export function useCategories(){return {categories:window.testCategories};}`:`export const supabaseUrl='https://example.invalid';export const supabaseAnonKey='synthetic-public-key';`}));
}}]});
const css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(file=>/^index-.*\.css$/.test(file))));
const server=createServer((req,res)=>{
  if(req.url==='/test.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].contents);}
  else if(req.url==='/test.css'){res.setHeader('Content-Type','text/css');res.end(css);}
  else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<link rel="stylesheet" href="/test.css"><div id="root"></div><script>window.audit={saves:[],closes:0};window.testCategories=[{slug:"plumbing",name:"السباكة",dbId:17}];window.formOptions={initialCategorySlug:"plumbing",initialCategory:{slug:"plumbing",name:"السباكة",dbId:17,sectionSlug:"plumbing"},joinSection:{slug:"plumbing",name:"السباكة"}};</script><script src="/test.js"></script>');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
fs.mkdirSync('.cache/add-service-ui',{recursive:true});
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  for(const width of [320,390,1280]){
    const page=await browser.newPage();await page.setViewport({width,height:900});const errors=[],dialogs=[];
    page.on('pageerror',error=>errors.push(String(error)));page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});
    await page.setRequestInterception(true);page.on('request',request=>{if(new URL(request.url()).origin===origin||request.url().startsWith('data:'))void request.continue();else void request.abort();});
    await page.goto(origin);await page.waitForSelector('#service-name');
    const checkTitle=async()=>{const result=await page.$eval('#service-modal-title',title=>{const text=title.querySelector('span'),range=document.createRange();range.selectNodeContents(text);const box=title.getBoundingClientRect(),dialog=title.closest('[role="dialog"]').firstElementChild.getBoundingClientRect();return {text:title.textContent,lines:range.getClientRects().length,centered:Math.abs((box.left+box.right)/2-(dialog.left+dialog.right)/2)<1};});assert.equal(result.text,'أضف خدمتك وكن مع وصال');assert.equal(result.lines,1);assert.equal(result.centered,true);};
    await checkTitle();assert.equal(await page.$('[aria-invalid="true"]'),null);assert.equal(await page.$('button[type="submit"]:disabled'),null);
    await page.$eval('button[type="submit"]',button=>button.click());
    const emptyRequired=await page.$$eval('form input[required],form select[required],form textarea[required]',fields=>fields.filter(field=>!field.value.trim()).length);
    assert.ok(emptyRequired>=3);assert.equal(await page.$$eval('form input[aria-invalid="true"],form select[aria-invalid="true"],form textarea[aria-invalid="true"]',fields=>fields.length),emptyRequired);
    assert.equal(await page.evaluate(()=>window.audit.saves.length),0);assert.equal(await page.evaluate(()=>document.body.innerText.includes('أكمل الحقول المطلوبة')),false);
    assert.equal(await page.$$eval('form p',nodes=>nodes.filter(node=>node.textContent==='هذا الحقل مطلوب').length),emptyRequired);
    await page.$eval('#service-name',input=>input.scrollIntoView({block:'center'}));await page.screenshot({path:`.cache/add-service-ui/${width}-validation.png`});
    const required=await page.$$('form input[required],form select[required],form textarea[required]');
    for(const field of required){
      const tag=await field.evaluate(field=>field.tagName);
      if(tag==='SELECT'){const value=await field.evaluate(field=>[...field.options].find(option=>!option.disabled&&option.value&&option.value!=='__custom__')?.value);if(value)await field.select(value);}
      else{await field.evaluate(field=>field.scrollIntoView({block:'center'}));await field.type('خدمة تجريبية');}
      assert.equal(await field.evaluate(field=>field.getAttribute('aria-invalid')),'false');
    }
    assert.equal(await page.$('[aria-invalid="true"]'),null);assert.equal(await page.$eval('#service-phone',field=>field.required),false);
    assert.equal(await page.$$eval('form input',fields=>fields.filter(field=>field.placeholder.includes(',')).some(field=>field.required||field.getAttribute('aria-invalid')==='true')),false);
    assert.equal(await page.$('input[id^="social-"]'),null);
    for(const [platform,id] of [['WhatsApp','whatsapp'],['Facebook','facebook'],['Instagram','instagram'],['TikTok','tiktok']]){
      const selector=`button[aria-label="إضافة ${platform}"]`;await page.$eval(selector,button=>button.click());await page.waitForSelector(`#social-${id}`);assert.equal(await page.$eval(selector,button=>button.getBoundingClientRect().width),32);await page.$eval(selector,button=>button.click());assert.equal(await page.$(`#social-${id}`),null);
    }
    const upload=await page.$('input[type="file"]');assert.equal(await upload.evaluate(field=>field.multiple),false);await upload.uploadFile('public/category-photos/cars.webp');
    await page.waitForSelector('img[alt="Preview"]');assert.equal(await page.$$eval('img[alt="Preview"]',images=>images.length),1);
    await page.$eval('button[type="submit"]',button=>button.scrollIntoView({block:'end'}));
    const layout=await page.evaluate(()=>{const form=document.querySelector('form'),button=form.querySelector('button[type="submit"]'),box=button.getBoundingClientRect(),lastInput=form.querySelector('input[type="file"]').parentElement.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,rtl:getComputedStyle(form).direction,buttonsBelowImage:box.top>=lastInput.bottom,buttonVisible:box.bottom<=innerHeight};});
    assert.equal(layout.overflow,false);assert.equal(layout.rtl,'rtl');assert.equal(layout.buttonsBelowImage,true);assert.equal(layout.buttonVisible,true);await page.screenshot({path:`.cache/add-service-ui/${width}-complete.png`});
    await page.$eval('button[type="submit"]',button=>button.click());await page.waitForFunction(()=>window.audit.saves.length===1);
    const payload=await page.evaluate(()=>window.audit.saves[0]);assert.equal(payload.phone,'');assert.equal(payload.latitude,undefined);assert.equal(payload.longitude,undefined);assert.equal(payload.categoryId,17);assert.equal(payload.categorySlug,'plumbing');assert.equal(payload.status,'pending');assert.ok(payload.image.startsWith('data:image/'));assert.equal(payload.images,undefined);assert.equal(payload.video,undefined);assert.equal(await page.evaluate(()=>window.audit.closes),1);
    // Other sections and the general form share the same title/feedback implementation.
    for(const [slug,name] of [['doctors','الأطباء'],['pharmacy','الصيدليات'],['restaurants','المطاعم']]){
      await page.evaluate(({slug,name})=>{window.testCategories=[{slug,name,dbId:17}];window.showForm({initialCategorySlug:slug,initialCategory:{slug,name,dbId:17,sectionSlug:slug},joinSection:{slug,name}});},{slug,name});await page.waitForSelector('#service-name');await checkTitle();await page.$eval('button[type="submit"]',button=>button.click());assert.equal(await page.$eval('#service-name',field=>field.getAttribute('aria-invalid')),'true');assert.equal(await page.evaluate(()=>document.body.innerText.includes('أكمل الحقول المطلوبة')),false);
    }
    await page.evaluate(()=>window.showForm({initialCategorySlug:'restaurants'}));await page.waitForSelector('#service-category');await checkTitle();
    assert.deepEqual(dialogs,[]);assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px: centered one-line title; per-field errors/instant clearing; optional phone/location; social toggles; one optimized image; nonoverlapping buttons; unchanged successful-save payload (mock boundary); multiple section/general forms; RTL/no overflow`);await page.close();
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
