import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] || 'http://127.0.0.1:3000';
const output = '.cache/slider-position-admin';
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(`${output}/harness.tsx`, `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import SliderManager from '../../src/components/SliderManager';
import ToastProvider from '../../src/components/ToastProvider';
import {supabase} from '../../src/lib/supabase';
// Test document only: no production authentication or server data is changed.
supabase.auth.getSession = async () => ({data:{session:{access_token:'test-session'}},error:null});
document.getElementById('root').style.display='none';
const root=document.createElement('div'); root.id='admin-test'; root.dir='rtl'; document.body.append(root);
createRoot(root).render(<MemoryRouter><ToastProvider><SliderManager/></ToastProvider></MemoryRouter>);
`);
const photo = fs.readFileSync('public/category-photos/cars.webp');
const image = `data:image/webp;base64,${photo.toString('base64')}`;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  for (const width of [390, 1280]) {
    const page = await browser.newPage();
    const rows = [{id:1,title:'Existing slider',images:[image],url:image,is_active:true,sort_order:1,instagram_url:'https://instagram.com/example',social_icons_position:'right'}];
    const writes = [];
    await page.setViewport({width,height:1000});
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.origin === base || ['data:','blob:'].includes(url.protocol)) return request.continue();
      const headers = {'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
      if (request.method()==='OPTIONS') return request.respond({status:204,headers});
      if (url.pathname.includes('/storage/')) return request.respond({status:200,headers,contentType:request.method()==='GET'?'image/webp':'application/json',body:request.method()==='GET'?photo:'{}'});
      const endpoint=url.pathname.split('/').at(-1);
      let result = endpoint==='slider_images'?rows:endpoint==='is_admin'?false:[];
      if (endpoint==='slider_images' && ['POST','PATCH'].includes(request.method())) {
        const raw=JSON.parse(request.postData()), payload=Array.isArray(raw)?raw[0]:raw;
        // Exercise the existing retry for databases without optional design columns.
        if ('subtitle' in payload) return request.respond({status:400,headers,contentType:'application/json',body:JSON.stringify({code:'PGRST204',message:"Could not find the 'subtitle' column of 'slider_images' in the schema cache"})});
        writes.push({method:request.method(),payload});
        let row;
        if (request.method()==='POST') {row={id:77,...payload};rows.push(row);}
        else {row=rows.find(row=>String(row.id)===url.searchParams.get('id')?.replace('eq.',''));Object.assign(row,payload);}
        result=request.headers().accept?.includes('vnd.pgrst.object')?row:[row];
      }
      return request.respond({status:200,headers,contentType:'application/json',body:JSON.stringify(result)});
    });
    await page.goto(`${base}/#/`);
    await page.evaluate(path=>import(path), `/${output}/harness.tsx`);
    const clickText = async text => {
      await page.waitForFunction(text=>[...document.querySelectorAll('#admin-test button')].some(button=>button.textContent.includes(text)),{},text);
      await page.evaluate(text=>[...document.querySelectorAll('#admin-test button')].find(button=>button.textContent.includes(text)).click(),text);
    };
    await clickText('معاينة الشرائح');
    await page.waitForSelector('#admin-test button[title="تعديل الشريحة"]');
    await page.click('#admin-test button[title="تعديل الشريحة"]');
    const selector='#admin-test select[aria-label="موضع أيقونات التواصل"]';
    await page.waitForSelector(selector);
    assert.equal(await page.$eval(selector,select=>select.value),'right');
    assert.deepEqual(await page.$eval(selector,select=>[...select.options].map(option=>[option.value,option.textContent])),[['left','يسار'],['right','يمين'],['top','أعلى'],['bottom','أسفل']]);
    await page.select(selector,'top');
    await page.$eval(selector,select=>select.scrollIntoView({block:'center'}));
    await page.screenshot({path:`${output}/${width}-edit.png`});
    await clickText('حفظ التغييرات');
    await page.waitForSelector('#admin-test button[title="تعديل الشريحة"]');
    assert.equal(writes.find(write=>write.method==='PATCH').payload.social_icons_position,'top');
    assert.equal(rows[0].images[0],image);
    await clickText('العودة إلى إدارة السلايدر');
    await clickText('إضافة شريحة جديدة');
    await page.waitForSelector(selector);
    assert.equal(await page.$eval(selector,select=>select.value),'left');
    await page.select(selector,'bottom');
    await page.type('#admin-test input[placeholder="خدمات احترافية بجودة عالية"]','New slider');
    const file=await page.$('#admin-test input[type="file"]');
    await file.uploadFile('public/category-photos/cars.webp');
    await page.waitForSelector('#admin-test img[alt="معاينة صورة الشريحة"]');
    await page.$eval(selector,select=>select.scrollIntoView({block:'center'}));
    await page.screenshot({path:`${output}/${width}-add.png`});
    await clickText('حفظ الشريحة');
    await page.waitForFunction(()=>[...document.querySelectorAll('#admin-test button[title="تعديل الشريحة"]')].length===2);
    assert.equal(writes.find(write=>write.method==='POST').payload.social_icons_position,'bottom');
    assert.equal(rows[1].social_icons_position,'bottom');
    console.log(`PASS ${width}px: admin edit loads right and saves top; add defaults left and saves bottom; optional-design retry preserves position; API writes mocked`);
    await page.close();
  }
} finally {await browser.close();}
