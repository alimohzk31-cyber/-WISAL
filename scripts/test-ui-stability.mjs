// Real React components with synthetic dependencies. All external browser traffic is blocked.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mockBackend = `
const c=window.auditConfig;
export const supabaseUrl='https://blocked.invalid'; export const supabaseAnonKey='synthetic';
export const adminPinLogin=async()=>({ok:false}); export const isPinRateLimited=()=>false;
export const getPinRateLimitRemainingMs=()=>0; export const clearPinRateLimit=()=>{};
export const supabase={auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 from(table){let columns='*',filters=[];const q=new Proxy({}, {get(_,key){if(key==='then')return (resolve,reject)=>{
 window.audit.reads.push(table);
 if(c.hangServices&&table==='services')return new Promise(()=>{}).then(resolve,reject);
 let data=table==='categories'?[{id:'1',slug:'pharmacy',name_ar:'صيدلية'},{id:'2',slug:'restaurants',name_ar:'مطعم'}]:[];
 if(table==='services')data=c.rows||[];
 data=data.filter(row=>filters.every(([k,v])=>row[k]===v));
 const error=c.failServices&&table==='services'?{message:'Synthetic network failure'}:columns==='owner_id'?{code:'42703'}:null;
 return Promise.resolve({data,error}).then(resolve,reject);
 };return (...args)=>{if(key==='select')columns=args[0];if(key==='eq')filters.push(args);return q;};}});return q;},
 rpc:async()=>({data:[],error:null}),channel(){return {on(){return this},subscribe(){return this}}},removeChannel(){},storage:{from(){return {}}}};
`;
const mockCache = `const c=window.auditConfig;const cache={...c.cache};export default {config(){},async getItem(k){if(c.cacheFailure)throw Error('Synthetic storage unavailable');return cache[k]??null;},async setItem(k,v){cache[k]=v;return v;},async removeItem(k){delete cache[k]},async clear(){}};`;
const mockContext = `
import {mapRowToService} from './src/hooks/useServices';
const c=window.auditConfig;
export const ServicesProvider=({children})=>children;
export {getOwnerId} from './src/hooks/useServices';
export function useServices(){return {services:[],publicServices:(c.rows||[]).map(mapRowToService),loading:false,error:null,refreshServices:async()=>{},
addService:async p=>{window.audit.add.push(p);await new Promise(r=>setTimeout(r,100));if(c.failSave)throw Error('Synthetic save failure');return p;},
editService:async(id,p)=>{window.audit.edit.push({id,...p});await new Promise(r=>setTimeout(r,100));if(c.failSave)throw Error('Synthetic save failure');},deleteService:async()=>{},applyServiceUpdate(){},fetchAllPendingServices:async()=>[],fetchAllRejectedServices:async()=>[]};}
`;
const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';
import App from './src/App';import {ThemeProvider} from './src/context/ThemeContext';import {LanguageProvider} from './src/context/LanguageContext';
import Add from './src/components/AddServiceModal';import Edit from './src/components/EditServiceModal';
import SafeImage from './src/components/SafeImage';import PostInteractions from './src/components/PostInteractions';
import Detail from './src/components/ServiceDetailModal';import ErrorBoundary from './src/components/ErrorBoundary';
const BrokenPage=React.lazy(()=>Promise.reject(Error('Synthetic failed page chunk')));
import {useServices,mapRowToService} from './src/hooks/useServices';import {useCategories} from './src/hooks/useCategories';
const c=window.auditConfig;window.mapRowToService=mapRowToService;
const close=()=>window.audit.closed++;
function HookState(){const s=useServices();const cats=useCategories();window.serviceState=s;return <pre id="hook-state">{JSON.stringify({loading:s.loading,error:s.error,categories:cats.categories.length,count:s.services.length})}</pre>}
let content=c.scene==='add'?<Add initialCategorySlug="pharmacy" onClose={close}/>:
c.scene==='edit'?<Edit service={{id:1,slug:'one',name:'خدمة',location:'بغداد',image:'',categorySlug:'pharmacy',categoryId:'1',createdAt:1}} onClose={close}/>:
c.scene==='image'?<SafeImage src="" loading="eager"/>:
c.scene==='boundary'?<ErrorBoundary><React.Suspense fallback={<p>Loading</p>}><BrokenPage/></React.Suspense></ErrorBoundary>:
c.scene==='detail'?<Detail service={{id:1,slug:'one',name:'خدمة',location:'',image:'',video:'https://blocked.invalid/video.mp4',categorySlug:'pharmacy',status:'approved',createdAt:1,latitude:0,longitude:44}} onClose={close} theme="light" colors={{bg:'',text:'',shadow:''}}/>:
c.scene==='hook'?<HookState/>:
c.scene==='comment'?<PostInteractions serviceId={1} summary={{total:0,byType:{},top:null}} myReaction={null} comments={[{id:1,service_id:1,owner_id:'synthetic-owner',content:'تعليق',created_at:''}]} onToggleReaction={()=>{}} onAddComment={async()=>{}} onDeleteComment={async()=>{window.audit.deletes++;await new Promise(r=>setTimeout(r,100));throw Error('Synthetic delete failure')}}/>:<App/>;
createRoot(document.getElementById('root')).render(<ThemeProvider><LanguageProvider>{content}</LanguageProvider></ThemeProvider>);
`;
const bundle = await build({stdin:{contents:entry,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},plugins:[{name:'synthetic-only',setup(b){
 b.onResolve({filter:/(?:^|\/)lib\/supabase$/},()=>({path:'backend',namespace:'mock'}));
 b.onResolve({filter:/^localforage$/},()=>({path:'cache',namespace:'mock'}));
 b.onResolve({filter:/(?:^|\/)context\/ServicesContext$/},()=>({path:'context',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='backend'?mockBackend:args.path==='cache'?mockCache:mockContext,loader:'tsx',resolveDir:process.cwd()}));
}}]});
let config={};
const server=createServer((req,res)=>{
 if(req.url==='/test.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].contents);return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<div id="root"></div><script>window.auditConfig=${JSON.stringify(config)};window.audit={reads:[],add:[],edit:[],closed:0,deletes:0,errors:[]};window.alert=()=>{};addEventListener('unhandledrejection',e=>audit.errors.push(String(e.reason)));if(auditConfig.storageFailure){Storage.prototype.getItem=()=>{throw Error('Storage blocked')};Storage.prototype.setItem=()=>{throw Error('Storage blocked')};Storage.prototype.removeItem=()=>{throw Error('Storage blocked')}}else localStorage.setItem('saleen_owner_id','synthetic-owner');</script><script src="/test.js"></script>`);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const profile=await mkdtemp(path.join(tmpdir(),'wisal-stability-'));
const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let socket;let failures=0;const results=[];
try{
 const endpoint=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),20000);chrome.once('error',reject);chrome.stderr.on('data',data=>{output+=data;const m=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 const debugOrigin=endpoint.replace(/^ws:/,'http:').split('/devtools/')[0];const target=await fetch(debugOrigin+'/json/new?about:blank',{method:'PUT'}).then(r=>r.json());
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
 let sequence=0;const pending=new Map();const runtimeErrors=[];
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},20000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});socket.send(JSON.stringify({id,method,params}));});
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')runtimeErrors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Fetch.requestPaused'){const {requestId,request}=m.params;const local=new URL(request.url).origin===origin;send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId}:{requestId,errorReason:'BlockedByClient'}).catch(()=>{});}});
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const waitFor=async expression=>{for(let i=0;i<50;i++){if(await evaluate(expression))return;await delay(50);}throw Error('Missing UI: '+expression)};
 const open=async(c,hash='')=>{config=c;runtimeErrors.length=0;await send('Page.navigate',{url:origin+'/?run='+Math.random()+hash});await waitFor('!!window.mapRowToService');await delay(200)};
 const setValue=async(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
 const submit=()=>evaluate(`document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`);
 const test=async(name,run)=>{try{await run();results.push('PASS '+name)}catch(e){failures++;results.push('FAIL '+name+': '+e.message)}console.log(results.at(-1))};
 await test('Add form preserves the category chosen by the user',async()=>{await open({scene:'add'});await waitFor(`document.querySelector('select')?.value==='pharmacy'`);await setValue('select','restaurants');await delay(100);assert.equal(await evaluate(`document.querySelector('select').value`),'restaurants')});
 await test('Edit form sends the ID of the newly selected category',async()=>{await open({scene:'edit'});await setValue('select','restaurants');await submit();await delay(150);assert.equal(await evaluate('audit.edit[0]?.categoryId'),'2')});
 await test('A service form cannot close or submit twice while saving',async()=>{await open({scene:'add'});await evaluate(`const form=document.querySelector('form');form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));document.querySelector('[aria-label="إغلاق بدون حفظ"]').click()`);assert.equal(await evaluate('audit.add.length'),1);assert.equal(await evaluate('audit.closed'),0)});
 await test('Failed saves keep the form usable for retry',async()=>{await open({scene:'add',failSave:true});await submit();await delay(150);assert.equal(await evaluate('audit.closed'),0);assert.equal(await evaluate(`document.querySelector('button[type=submit]').disabled`),false)});
 await test('Unavailable cache does not prevent service fetching',async()=>{await open({scene:'hook',cacheFailure:true});await waitFor(`window.serviceState?.loading===false`);assert.ok(await evaluate(`audit.reads.includes('services')`));assert.deepEqual(await evaluate('audit.errors'),[])});
 await test('Malformed cache records cannot crash category/service rendering',async()=>{await open({scene:'hook',cache:{cached_services:[null],cached_categories:[null]}});await waitFor(`window.serviceState?.loading===false`);assert.deepEqual(runtimeErrors,[]);assert.deepEqual(await evaluate('audit.errors'),[])});
 await test('Service fetch failure exposes a retryable error',async()=>{await open({scene:'hook',failServices:true});await waitFor(`window.serviceState?.loading===false`);assert.ok(await evaluate('window.serviceState.error'));await evaluate('auditConfig.failServices=false;serviceState.refreshServices()');assert.equal(await evaluate('serviceState.error'),null)});
 await test('Invalid service date does not crash the feed',async()=>{await open({rows:[{id:1,slug:'one',title:'خدمة',category_slug:'pharmacy',status:'approved',created_at:'bad-date'}]});await waitFor(`!!document.querySelector('article')`);assert.deepEqual(runtimeErrors,[])});
 await test('Missing image source renders a local fallback',async()=>{await open({scene:'image'});await waitFor(`document.querySelector('img')?.naturalWidth>0`)});
 await test('Unknown URL offers navigation instead of a blank page',async()=>{await open({},'#/missing-route');await waitFor(`document.body.innerText.includes('الصفحة غير موجودة')`)});
 await test('Blocked browser storage does not crash the app',async()=>{await open({storageFailure:true});await waitFor(`document.body.innerText.includes('التصفح')`);assert.deepEqual(runtimeErrors,[])});
 await test('Comment deletion rejection is handled with a visible error',async()=>{await open({scene:'comment'});await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('تعليق')).click()`);await waitFor(`!!document.querySelector('[aria-label="حذف تعليقي"]')`);await evaluate(`document.querySelector('[aria-label="حذف تعليقي"]').click()`);await delay(150);assert.deepEqual(await evaluate('audit.errors'),[]);assert.ok(await evaluate(`document.body.innerText.includes('Synthetic delete failure')`))});
 await test('GPS coordinates edited by the user are the ones submitted',async()=>{await open({scene:'add'});await evaluate(`Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(success){success({coords:{latitude:33,longitude:44}})}}});document.querySelector('form button[title]').click()`);await delay(50);await setValue('input[dir=ltr]','34, 45');await submit();assert.equal(await evaluate('audit.add[0].latitude'),34);assert.equal(await evaluate('audit.add[0].longitude'),45)});
 await test('Out-of-range coordinates do not submit a service',async()=>{await open({scene:'add'});await setValue('input[dir=ltr]','91, 181');await submit();assert.equal(await evaluate('audit.add.length'),0)});
 await test('Failed page chunks expose a recovery action',async()=>{await open({scene:'boundary'});await waitFor(`document.querySelector('[role=alert]')?.innerText.includes('إعادة المحاولة')`)});
 await test('Detail modal locks background scrolling and closes with Escape',async()=>{await open({scene:'detail'});assert.equal(await evaluate('document.body.style.overflow'),'hidden');await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);assert.equal(await evaluate('audit.closed'),1)});
 await test('Failed service video offers retry; zero coordinates keep map links',async()=>{await open({scene:'detail'});await waitFor(`document.querySelector('video')||document.body.innerText.includes('تعذر تشغيل الفيديو')`);await evaluate(`document.querySelector('video')?.dispatchEvent(new Event('error'))`);await waitFor(`document.body.innerText.includes('تعذر تشغيل الفيديو')`);assert.ok(await evaluate(`document.querySelector('a[href*="query=0,44"]')!==null`));assert.ok(await evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent==='إعادة المحاولة')`))});
 await test('An indefinitely pending service read finishes with a retryable error',async()=>{await open({scene:'hook',hangServices:true});await delay(15100);await waitFor(`serviceState.loading===false && !!serviceState.error`);assert.deepEqual(await evaluate('audit.errors'),[])});
 console.log(JSON.stringify({passed:results.length-failures,failed:failures,scope:'Synthetic data only; external traffic blocked'}));
}finally{socket?.close();chrome.kill();server.close();const resolved=path.resolve(profile);if(path.dirname(resolved)===path.resolve(tmpdir())&&path.basename(resolved).startsWith('wisal-stability-'))await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
if(failures)process.exitCode=1;
