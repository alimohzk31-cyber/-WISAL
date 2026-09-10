// Real React/AuthProvider/AdminRoute integration, isolated Chrome and synthetic Auth.
// No requests or writes reach Supabase. No application source is rewritten.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mock = `
const config = window.auditConfig;
const listeners = new Set();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const makeSession = (id = 'admin') => ({access_token:'synthetic-'+id, user:{id}, expires_at:config.expiring ? Math.ceil((Date.now()+1500)/1000) : Math.floor(Date.now()/1000)+3600});
const audit = window.audit = { session:config.noSession ? null : makeSession(), mounts:0, userCalls:0, roleCalls:0,
 emit(session){audit.session=session;for(const listener of listeners)listener(session?'TOKEN_REFRESHED':'SIGNED_OUT',session);},
 switchUser(){audit.emit(makeSession('regular'));}, makeSession,
};
export const supabase = {
 auth:{
  getSession:async()=>({data:{session:audit.session},error:null}),
  onAuthStateChange:fn=>{listeners.add(fn);return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}};},
  getUser:async token=>{audit.userCalls++;await delay(120);return {data:{user:config.invalidUser?null:{id:token.replace('synthetic-','')}},error:config.invalidUser?new Error('Synthetic invalid session'):null};},
  signOut:async()=>audit.emit(null),
 },
 rpc(name){
  if(name!=='is_admin')throw Error('Unexpected RPC');
  audit.roleCalls++;
  let token=audit.session?.access_token;
  const query={setHeader:(_name,value)=>{token=value.replace('Bearer ','');return query;},abortSignal:()=>query,
   then(resolve,reject){return delay(120).then(()=>({data:!config.nonAdmin&&token==='synthetic-admin',error:config.rpcError?new Error('Synthetic RPC failure'):null})).then(resolve,reject);}};
  return query;
 }
};
export const adminPinLogin=async()=>{throw Error('PIN login is outside this test');};
`;
const entry = `
import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter,Routes,Route,Outlet,useOutletContext} from 'react-router-dom';
import {AuthProvider} from './src/context/AuthContext';
import AdminRoute from './src/components/AdminRoute';
function Layout(){return <Outlet context={{marker:'inherited-layout'}}/>;}
function Dashboard(){const [tab,setTab]=useState('dashboard');const ctx=useOutletContext();useEffect(()=>{window.audit.mounts++;},[]);return <div data-admin={ctx.marker}><button onClick={()=>setTab('notifications')}>Notifications</button><span>{tab}</span></div>;}
createRoot(document.getElementById('root')).render(<AuthProvider><HashRouter><Routes><Route element={<Layout/>}><Route path='/' element={<div data-public>Public</div>}/><Route element={<AdminRoute/>}><Route path='/admin' element={<Dashboard/>}/></Route></Route></Routes></HashRouter></AuthProvider>);
`;
const bundle = await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-auth',setup(b){b.onResolve({filter:/\/lib\/supabase$/},()=>({path:'audit-auth',namespace:'audit'}));b.onLoad({filter:/.*/,namespace:'audit'},()=>({contents:mock,loader:'js'}));}}]});
// Assert the real application nests its admin page under the tested boundary.
const app=await readFile('src/App.tsx','utf8');
assert.match(app,/<Route element=\{<AdminRoute\s*\/>\}>\s*<Route path="admin" element=\{<AdminDashboard\s*\/>\}\s*\/>\s*<\/Route>/);
let config={};
const server=createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.url==='/test.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].contents);return;}
 res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script>window.auditConfig='+JSON.stringify(config)+'</script><script src="/test.js"></script>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(path.join(tmpdir(),'wisal-admin-route-'));
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
 let sequence=0;
 const pending=new Map();
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},15000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params}));});
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const p=pending.get(message.id);pending.delete(message.id);message.error?p?.reject(Error(message.error.message)):p?.resolve(message.result);}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);else if(message.method==='Fetch.requestPaused'){const {requestId,request}=message.params;const local=new URL(request.url).origin===origin;send(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId}:{requestId,errorReason:'BlockedByClient'}).catch(e=>errors.push(e.message));}});
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 const waitFor=async expression=>{for(let i=0;i<200;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,25));}throw Error('Timed out: '+expression);};
 const open=async next=>{config=next;await send('Page.navigate',{url:origin+'/?run='+Math.random()+'#/admin'});await waitFor('!!window.audit');};
 const publicOnly=async()=>{await waitFor('!!document.querySelector("[data-public]")');assert.equal(await evaluate('!!document.querySelector("[data-admin]")'),false);};
 const noFlash=async()=>{await waitFor('!!document.querySelector("[role=status]")');assert.equal(await evaluate('window.audit.mounts'),0);assert.equal(await evaluate('!!document.querySelector("[data-admin]")'),false);};
 const pass=name=>{results.push({name,passed:true});console.log('PASS: '+name);};

 await open({noSession:true});await publicOnly();assert.equal(await evaluate('window.audit.mounts'),0);pass('1. Direct /admin without session denied; dashboard never mounted');
 await open({nonAdmin:true});await noFlash();await publicOnly();assert.equal(await evaluate('window.audit.mounts'),0);pass('2. Non-admin session denied after verification; no content flash');
 await open({});await noFlash();await waitFor('!!document.querySelector("[data-admin]")');assert.equal(await evaluate('document.querySelector("[data-admin]").dataset.admin'),'inherited-layout');await evaluate('document.querySelector("[data-admin] button").click()');await waitFor('document.querySelector("[data-admin]")?.textContent.includes("notifications")');pass('3. Verified admin allowed; nested section and outlet context preserved');
 await evaluate('window.audit.emit(null)');await publicOnly();pass('4a. Session removed while inside admin: access removed');
 await open({expiring:true});await waitFor('!!document.querySelector("[data-admin]")');await publicOnly();pass('4b. Session expires without renewal: access removed');
 await open({});await waitFor('!!document.querySelector("[data-admin]")');await send('Page.reload');await noFlash();await waitFor('!!document.querySelector("[data-admin]")');assert.ok(await evaluate('window.audit.userCalls')>0);pass('5. Refresh verifies identity and role before mounting dashboard');
 await open({rpcError:true});await noFlash();await publicOnly();assert.equal(await evaluate('window.audit.mounts'),0);pass('RPC failure fails closed');
 await open({invalidUser:true});await noFlash();await publicOnly();assert.equal(await evaluate('window.audit.mounts'),0);pass('Server rejects cached identity: denied');
 await open({});await waitFor('window.audit.userCalls>0');await evaluate('window.audit.emit(null)');await publicOnly();await new Promise(r=>setTimeout(r,400));assert.equal(await evaluate('window.audit.mounts'),0);pass('Late verification after logout cannot restore access');
 await open({});await waitFor('!!document.querySelector("[data-admin]")');await evaluate('window.audit.switchUser()');await publicOnly();pass('Changing to a different user removes previous admin access');
 assert.deepEqual(errors,[]);
 await mkdir('release/admin-route-qa',{recursive:true});
 await writeFile('release/admin-route-qa/results.json',JSON.stringify({scope:'Real React/AuthProvider/AdminRoute; synthetic Supabase; zero production requests',results},null,2));
 console.log('All admin route tests passed. No production requests.');
} finally {
 if(socket?.readyState===WebSocket.OPEN)socket.close();
 chrome.kill();server.close();
 await new Promise(resolve=>setTimeout(resolve,500));
 const resolved=path.resolve(profile);
 if(path.dirname(resolved)===path.resolve(tmpdir())&&path.basename(resolved).startsWith('wisal-admin-route-'))await rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
