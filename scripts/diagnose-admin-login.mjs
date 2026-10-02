import puppeteer from 'puppeteer-core';
import {appendFile, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
// Runtime output must stay outside Vite's watched source tree. Writing a JSONL
// there sends full-reload to every connected client, clearing fresh PIN proof.
const outputDirectory=path.join(tmpdir(),'wisal-admin-diagnostic');
await mkdir(outputDirectory,{recursive:true});
const log=async entry=>appendFile(path.join(outputDirectory,'events.jsonl'),JSON.stringify({at:new Date().toISOString(),...entry})+'\n');
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:false,defaultViewport:{width:1920,height:1080},args:['--window-size=1920,1080']});
await writeFile(path.join(outputDirectory,'browser-endpoint.txt'),browser.wsEndpoint());
const page=(await browser.pages())[0];
const cdp=await page.createCDPSession();
await cdp.send('Network.enable');
cdp.on('Network.webSocketFrameReceived',event=>{
  try { const frame=JSON.parse(event.response.payloadData);if(frame.type==='full-reload')void log({kind:'vite-full-reload',path:frame.path}); } catch{}
});
page.on('framenavigated',frame=>{if(frame===page.mainFrame())void log({kind:'navigation',url:frame.url()});});
page.on('load',()=>void log({kind:'document-load',url:page.url()}));
page.on('pageerror',err=>void log({kind:'pageerror',message:err.message}));
page.on('console',msg=>{if(msg.type()==='error'||msg.text().startsWith('[AdminPerformance]'))void log({kind:'console',type:msg.type(),message:msg.text().replace(/eyJ[A-Za-z0-9_.-]+/g,'[REDACTED]')});});
page.on('response',async res=>{
const pathname=new URL(res.url()).pathname;
if(!/admin-login|auth\/v1\/user|rpc\/is_admin/.test(pathname))return;
const entry={kind:'network',path:pathname,status:res.status()};
try {const body=await res.json(); if(pathname.endsWith('admin-login'))Object.assign(entry,{ok:body.ok,success:body.success,code:body.code,hasAccessToken:typeof body.access_token==='string'&&body.access_token.length>0,hasRefreshToken:typeof body.refresh_token==='string'&&body.refresh_token.length>0});else if(pathname.endsWith('is_admin'))entry.allowed=body===true;else entry.hasUserId=typeof body.id==='string';}catch{}
void log(entry);
});
page.on('requestfailed',req=>{const u=new URL(req.url());if(u.hostname.endsWith('supabase.co'))void log({kind:'requestfailed',path:u.pathname,error:req.failure()?.errorText});});
await page.goto('http://192.168.1.111:3000/',{waitUntil:'domcontentloaded'});
await page.evaluate(()=>sessionStorage.setItem('admin_performance','1'));
await log({kind:'ready',url:'http://192.168.1.111:3000/'});
let previous='';
setInterval(async()=>{try{const state=await page.evaluate(()=>({hash:location.hash,modal:!!document.querySelector('input[name="admin-pin"]'),dashboard:!!document.querySelector('.wisal-admin-shell'),error:document.querySelector('input[name="admin-pin"]')?.closest('form')?.querySelector('p')?.textContent||null}));const str=JSON.stringify(state);if(str!==previous){previous=str;await log({kind:'ui',...state});if(state.dashboard)await page.screenshot({path:path.join(outputDirectory,'admin-dashboard-authenticated-1920.png')});}}catch{}},1000);
