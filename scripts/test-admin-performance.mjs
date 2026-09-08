// Local integration tests: actual React hooks/AuthProvider/AdminRoute and synthetic Supabase.
// Network access is blocked except the temporary loopback fixture server.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mock = `
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const listeners = new Set();
const callbacks = new Set();
const row = (id,status='pending') => ({id,slug:'service-'+id,title:'Service '+id,category_id:'1',category_slug:'test',status,created_at:new Date().toISOString(),owner_id:'test-owner'});
const a = window.audit = { session:null, calls:[], rows:[row(1),row(2)], failUpdate:false, failLists:false, listDelay:100, idDelay:700, cacheDelay:200, rpcDelay:80, cache:{},
 emit(){for(const cb of callbacks)cb();}, row,
};
const record = (name,args) => {const call={name,at:performance.now(),args};a.calls.push(call);return call;};
export function createClient(){return {
 auth:{
  getSession:async()=>({data:{session:a.session},error:null}),
  onAuthStateChange:fn=>{listeners.add(fn);return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}};},
  async setSession(tokens){record('setSession');await delay(120);a.session={...tokens,user:{id:'admin'},expires_at:Math.floor(Date.now()/1000)+3600};for(const fn of listeners)fn('SIGNED_IN',a.session);return {data:{session:a.session},error:null};},
  async getUser(){const call=record('getUser');await delay(80);call.ms=performance.now()-call.at;return {data:{user:{id:'admin'}},error:null};},
  async signOut(){a.session=null;for(const fn of listeners)fn('SIGNED_OUT',null);return {error:null};},
 },
 functions:{async invoke(name){record(name);await delay(80);return {data:{access_token:'synthetic-token',refresh_token:'synthetic-refresh'},error:null};}},
 rpc(name,args){
  let query={setHeader:()=>query,abortSignal:()=>query,then(resolve,reject){return (async()=>{
   const call=record(name,args);
   if(name==='is_admin'){await delay(80);call.ms=performance.now()-call.at;return {data:!!a.session,error:null};}
   if(name==='admin_list_services'){const data=structuredClone(a.rows.filter(r=>r.status===args.p_status));await delay(a.listDelay);return {data,error:a.failLists?{message:'Synthetic lists failure'}:null};}
   if(name==='get_own_pending_service_id'){await delay(a.idDelay);return {data:a.rows.find(r=>r.slug===args.p_slug)?.id,error:null};}
   if(name==='admin_update_service'||name==='admin_set_service_status'){
    await delay(a.rpcDelay);
    if(a.failUpdate)return {data:null,error:{message:'Synthetic permission failure',code:'42501'}};
    const r=a.rows.find(r=>r.id===args.p_id);if(!r)return {data:null,error:null};
    Object.assign(r,args.p_payload||{status:args.p_status,rejection_reason:args.p_rejection_reason});
    return {data:structuredClone(r),error:null};
   }
   throw Error('Unexpected RPC '+name);
  })().then(resolve,reject);}};return query;
 },
 from(table){let filters={},payload=null,columns='*',range=null;const q={
  select(c){columns=c;return q;},eq(k,v){filters[k]=v;return q;},limit(){return q;},order(){return q;},
  range(from,to){range=[from,to];return q;},
  insert(p){payload=p;return q;},
  then(resolve,reject){return (async()=>{
   record(table+(payload?'.insert':'.select'),filters);await delay(80);
   if(payload){if(a.failInsert)return {data:null,error:{message:'Synthetic INSERT failure'}};a.rows.push({...row(100+a.rows.length),...payload[0]});return {data:null,error:null};}
   if(table==='categories')return {data:[{id:'1',slug:'test'}],error:null};
   if(columns==='owner_id')return {data:[],error:null};
   const rows=a.rows.filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v));
   return {data:structuredClone(range?rows.slice(range[0],range[1]+1):rows),error:null};
  })().then(resolve,reject);}
 };return q;},
 channel(){const ch={on(_e,_f,cb){callbacks.add(cb);ch.cb=cb;return ch;},subscribe(){return ch;}};return ch;},
 removeChannel(ch){callbacks.delete(ch.cb);return Promise.resolve();},
};}
`;
const cacheMock = `
export const OFFLINE_KEYS={SERVICES:'services',PENDING_SERVICES:'queue'};
export const offlineStore={
 async getItem(key){await new Promise(r=>setTimeout(r,window.audit.cacheDelay));return structuredClone(window.audit.cache[key]||null);},
 async setItem(key,value){await new Promise(r=>setTimeout(r,window.audit.cacheDelay));window.audit.cache[key]=structuredClone(value);return value;},
};
`;
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter,Routes,Route} from 'react-router-dom';
import {AuthProvider,useAuth} from './src/context/AuthContext';
import AdminRoute from './src/components/AdminRoute';
import {useServices,mapRowToService} from './src/hooks/useServices';
import {useAdminServiceLists} from './src/hooks/useAdminServiceLists';
import {supabase} from './src/lib/supabase';
import {getAdminPerformanceSamples,measureAdminOperation} from './src/lib/adminPerformance';
function Dashboard(){
 const services=useServices();
 const lists=useAdminServiceLists(services.fetchAllPendingServices,services.fetchAllRejectedServices,services.refreshServices);
 window.fixture={services,lists, samples:getAdminPerformanceSamples, async reject(id){
  const {data,error}=await measureAdminOperation('admin.reject',()=>supabase.rpc('admin_set_service_status',{p_id:id,p_status:'rejected',p_rejection_reason:null}));
  if(error||!data)throw error||Error('no row');services.applyServiceUpdate(mapRowToService(data));
 }};
 return <div data-admin>{JSON.stringify({pending:lists.pending.map(s=>s.id),rejected:lists.rejected.map(s=>s.id),approved:services.publicServices.map(s=>s.id),loading:services.loading})}</div>;
}
function Login(){const auth=useAuth();window.login=()=>auth.loginWithPin('synthetic');return <button>Login</button>;}
createRoot(document.getElementById('root')).render(<AuthProvider><HashRouter><Routes><Route path='/' element={<Login/>}/><Route element={<AdminRoute/>}><Route path='/admin' element={<Dashboard/>}/></Route></Routes></HashRouter></AuthProvider>);
`;
const bundle = await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},plugins:[{name:'synthetic-only',setup(b){
 b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'supabase',namespace:'mock'}));
 b.onResolve({filter:/\/lib\/offlineStore$/},()=>({path:'cache',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='cache'?cacheMock:mock,loader:'js'}));
}}]});
// A byte-for-byte comparison with the initial snapshot, when present.
try { assert.equal(await readFile('src/components/AdminRoute.tsx','utf8'),await readFile('.task-backup/admin-performance/AdminRoute.tsx.bak','utf8')); }
catch(error){if(error.code!=='ENOENT')throw error;}
const server=createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.url==='/test.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].contents);return;}
 res.setHeader('Content-Type','text/html');
 res.end('<div id="root"></div><script>sessionStorage.setItem("admin_performance","1");localStorage.setItem("owner_id","test-owner")</script><script src="/test.js"></script>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(path.join(tmpdir(),'saleen-admin-performance-'));
const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let socket;
const results=[];
const errors=[];
try {
 const debuggerUrl=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Chrome startup timeout')),20000);chrome.once('error',reject);chrome.stderr.on('data',data=>{output+=data;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
 const debugOrigin=debuggerUrl.replace(/^ws:/,'http:').split('/devtools/')[0];
 const target=await fetch(debugOrigin+'/json/new?about:blank',{method:'PUT'}).then(r=>r.json());
 socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 let sequence=0;const pending=new Map();
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},15000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params}));});
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);pending.delete(message.id);message.error?p?.reject(Error(message.error.message)):p?.resolve(message.result);}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);else if(message.method==='Fetch.requestPaused'){const {requestId,request}=message.params;const local=new URL(request.url).origin===origin;send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId}:{requestId,errorReason:'BlockedByClient'}).catch(e=>errors.push(e.message));}});
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 const waitFor=async expression=>{for(let i=0;i<250;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,25));}throw Error('Timed out: '+expression);};
 const pass=(name,details={})=>{results.push({name,passed:true,...details});console.log('PASS: '+name+' '+JSON.stringify(details));};
 const state=()=>evaluate('JSON.parse(document.querySelector("[data-admin]").textContent)');
 await send('Page.navigate',{url:origin});await waitFor('!!window.login');
 const login=await evaluate('(async()=>{const start=performance.now();const result=await window.login();return {result,ms:performance.now()-start};})()');
 assert.equal(login.result.ok,true);
 assert.equal(await evaluate('audit.calls.filter(c=>c.name==="is_admin").length'),1);
 pass('PIN login preserves DB role check and avoids duplicate auth-event RPC',{ms:login.ms});
 await evaluate('window.guardStart=performance.now();location.hash="/admin"');
 await waitFor('!!document.querySelector("[data-admin]")');
 const guardMs=await evaluate('performance.now()-window.guardStart');
 assert.equal(await evaluate('audit.calls.filter(c=>c.name==="is_admin").length'),2);
 assert.equal(await evaluate('audit.calls.filter(c=>c.name==="getUser").length'),1);
 pass('Unchanged AdminRoute separately verifies identity and DB role',{ms:guardMs});
 const authCalls=await evaluate('audit.calls.filter(c=>c.name==="getUser"||c.name==="is_admin")');
 await waitFor('window.fixture?.lists.pending.length===2 && !window.fixture.services.loading');
 await evaluate('audit.cacheDelay=0');
 await new Promise(r=>setTimeout(r,700));
 const before=await evaluate('audit.calls.length');
 await evaluate('fixture.lists.reload(false);fixture.lists.reload(false);fixture.lists.reload(false)');
 await new Promise(r=>setTimeout(r,300));
 assert.equal(await evaluate('audit.calls.length'),before);
 pass('Fresh tab changes issue no redundant queries');
 await evaluate('audit.calls=[];for(let i=0;i<8;i++)audit.emit()');
 await new Promise(r=>setTimeout(r,700));
 assert.equal(await evaluate('audit.calls.filter(c=>c.name==="admin_list_services").length'),2);
 pass('Realtime burst produces one pending/rejected pair');
 await evaluate('audit.calls=[];audit.listDelay=500;fixture.lists.reload()');
 await waitFor('audit.calls.some(c=>c.name==="admin_list_services")');
 const approve=await evaluate('(async()=>{audit.cacheDelay=800;const start=performance.now();await fixture.services.editService(1,{status:"approved"});return performance.now()-start;})()');
 assert.ok(approve<450,'Approval waited for cache/list fetch');
 await waitFor('!fixture.lists.pending.some(s=>s.id===1) && fixture.services.publicServices.some(s=>s.id===1)');
 await new Promise(r=>setTimeout(r,550));
 assert.ok(!(await state()).pending.includes(1));
 pass('Approve resolves after RPC; delayed stale list cannot restore pending row',{ms:approve});
 await evaluate('audit.cacheDelay=0');
 await new Promise(r=>setTimeout(r,1800));
 await evaluate('audit.calls=[]');
 const reject=await evaluate('(async()=>{const start=performance.now();await fixture.reject(2);return performance.now()-start;})()');
 await waitFor('fixture.lists.rejected.some(s=>s.id===2) && !fixture.lists.pending.some(s=>s.id===2)');
 assert.ok(reject<450);
 assert.equal(await evaluate('audit.calls.filter(c=>c.name==="admin_list_services"||c.name==="services.select").length'),0);
 pass('Reject uses confirmed row with zero full-list queries',{ms:reject});
 await evaluate('audit.failUpdate=true');
 const failed=await evaluate('(async()=>{try{await fixture.services.editService(2,{status:"approved"});return false;}catch{return true;}})()');
 assert.equal(failed,true);assert.ok((await state()).rejected.includes(2));
 pass('Failed approval leaves status unchanged');
 const rejectedFailed=await evaluate('(async()=>{try{await fixture.reject(1);return false;}catch{return true;}})()');
 assert.equal(rejectedFailed,true);assert.ok((await state()).approved.includes(1));
 pass('Failed rejection leaves approved row unchanged');
 const invalidId=await evaluate('(async()=>{const calls=audit.calls.length;try{await fixture.services.editService("invalid",{status:"approved"});return false;}catch{return audit.calls.length===calls;}})()');
 assert.equal(invalidId,true);pass('Invalid primary key never sends an UPDATE');
 await evaluate('audit.failUpdate=false; audit.failLists=true;fixture.lists.reload()');
 await new Promise(r=>setTimeout(r,800));
 assert.ok((await state()).rejected.includes(2));
 pass('Failed refresh retains last server-confirmed lists');
 await evaluate('audit.failLists=false;audit.listDelay=100;audit.calls=[]');
 const add=await evaluate('(async()=>{const start=performance.now();await fixture.services.addService({slug:"new-local",name:"New",location:"",image:"",categorySlug:"test",categoryId:"1",status:"pending"});return {start,ms:performance.now()-start};})()');
 assert.ok(add.ms<450,'Save waited for owner ID enrichment');
 await waitFor('fixture.lists.pending.some(s=>s.slug==="new-local")');
 const visibleMs=await evaluate('performance.now()')-add.start;
 assert.ok(visibleMs<700,'Admin waited for slow owner ID lookup');
 assert.ok(!(await state()).approved.includes(102));
 pass('Insert appears through admin RPC before slow ID lookup; stays pending',{saveMs:add.ms,visibleMs});
 await evaluate('audit.failInsert=true');
 const insertFailed=await evaluate('(async()=>{try{await fixture.services.addService({slug:"failed-insert",name:"Fail",location:"",image:"",categorySlug:"test",categoryId:"1",status:"pending"});return false;}catch{return true;}})()');
 assert.equal(insertFailed,true);
 assert.equal(await evaluate('fixture.lists.pending.some(s=>s.slug==="failed-insert") || fixture.services.services.some(s=>s.slug==="failed-insert")'),false);
 pass('Failed INSERT never appears in either list');
 await new Promise(r=>setTimeout(r,1400));
 await evaluate('audit.calls=[];window.fetches=[fixture.services.refreshServices(),fixture.services.refreshServices(),fixture.services.refreshServices()]');
 assert.equal(await evaluate('window.fetches[0]===window.fetches[1] && window.fetches[1]===window.fetches[2]'),true);
 await evaluate('Promise.all(window.fetches)');
 assert.equal(await evaluate('audit.calls.filter(c=>c.name==="services.select"&&c.args.status==="approved").length'),1);
 pass('Concurrent public refreshes share one request and avoid loading reset');
 assert.equal((await state()).loading,false);
 const samples=await evaluate('fixture.samples()');
 assert.ok(samples.some(s=>s.step==='admin-login'));
 assert.ok(samples.some(s=>s.step==='setSession'));
 assert.ok(samples.some(s=>s.step==='is_admin.context'));
 assert.deepEqual(errors,[]);
 await mkdir('release/admin-performance-qa',{recursive:true});
 await writeFile('release/admin-performance-qa/results.json',JSON.stringify({scope:'Local synthetic Supabase only; network blocked except loopback; these are not production timings',delaysMs:{adminLogin:80,setSession:120,isAdmin:80,getUser:80,update:80,lists:100,slowLists:500,pendingId:700,slowCache:800},results,authCalls,samples},null,2));
 console.log('All local performance regression tests passed.');
} finally {
 if(socket?.readyState===WebSocket.OPEN)socket.close();chrome.kill();server.close();
 await new Promise(resolve=>setTimeout(resolve,500));
 const resolved=path.resolve(profile);
 if(path.dirname(resolved)===path.resolve(tmpdir())&&path.basename(resolved).startsWith('saleen-admin-performance-'))await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
