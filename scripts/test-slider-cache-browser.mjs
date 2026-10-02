import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import puppeteer from 'puppeteer-core';
const sw=await readFile('dist/sw.js','utf8');let color='red',imageRequests=0;
const server=createServer((req,res)=>{
 if(req.url==='/sw.js'){res.setHeader('Content-Type','text/javascript');res.end(sw);}
 else if(req.url.startsWith('/image.svg')){imageRequests++;res.setHeader('Content-Type','image/svg+xml');res.setHeader('Cache-Control','public,max-age=31536000');res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="${color}"/></svg>`);}
 else {res.setHeader('Content-Type','text/html');res.end('<html><body>Slider cache QA</body></html>');}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
 await page.setCacheEnabled(false);
 const pixel=()=>page.evaluate(async()=>{const image=new Image();image.src='/image.svg?_wisal_slider=1&_wisal_rev=unchanged';await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=4;const context=canvas.getContext('2d');context.drawImage(image,0,0);return Array.from(context.getImageData(0,0,1,1).data);});
 assert.deepEqual(await pixel(),[255,0,0,255]);color='blue';
 await page.reload({waitUntil:'networkidle0'});
 assert.deepEqual(await pixel(),[0,0,255,255]);assert.ok(imageRequests>=2,'Same URL fetches fresh bytes despite long HTTP max-age');
 await page.setOfflineMode(true);assert.deepEqual(await pixel(),[0,0,255,255]);
 console.log(JSON.stringify({cache:'PASS',sameUrlImageOverwrite:'PASS',offlineLatestImage:'PASS',realBrowser:true,imageRequests}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
