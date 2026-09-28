// Browser integration of the real PIN modal, login helper, AuthProvider and guard.
// Only the Supabase SDK boundary is simulated. No production requests or secrets.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePin = '731946'; // Synthetic fixture, never the deployed ADMIN_PIN.
const sessionKey = 'wisal-regression-synthetic-session';

// Check actual JSX ancestry, permitting Suspense/ErrorBoundary wrappers.
const app = ts.createSourceFile('App.tsx', await readFile(path.join(root, 'src/App.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const tag = node => ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
const containsTag = (node, name) => {
  let found = tag(node)?.tagName.getText(app) === name;
  ts.forEachChild(node, child => { if (containsTag(child, name)) found = true; });
  return found;
};
let adminRoutes = 0;
function checkRoutes(node, guarded = false) {
  const opening = tag(node);
  if (opening?.tagName.getText(app) === 'Route') {
    const attrs = opening.attributes.properties;
    const element = attrs.find(attr => ts.isJsxAttribute(attr) && attr.name.getText(app) === 'element');
    const routePath = attrs.find(attr => ts.isJsxAttribute(attr) && attr.name.getText(app) === 'path');
    const isGuard = element && containsTag(element, 'AdminRoute');
    if (element && containsTag(element, 'AdminDashboard')) {
      adminRoutes++;
      assert.ok(guarded, 'AdminDashboard must remain nested inside AdminRoute');
      assert.equal(routePath?.initializer?.text, 'admin');
    }
    guarded ||= Boolean(isGuard);
  }
  ts.forEachChild(node, child => checkRoutes(child, guarded));
}
checkRoutes(app);
assert.equal(adminRoutes, 1, 'Exactly one guarded admin route is expected');

const mock = `
const config = window.auditConfig;
const listeners = new Set();
const storageKey = ${JSON.stringify(sessionKey)};
const delay = () => new Promise(resolve => setTimeout(resolve, 60));
const makeSession = (id = 'admin') => ({access_token:'synthetic-'+id, refresh_token:'synthetic-refresh', user:{id}, expires_at:Math.floor(Date.now()/1000)+3600});
const audit = window.audit = { session:JSON.parse(localStorage.getItem(storageKey) || 'null'), mounts:0, submits:0, pinCalls:0, installs:0, userCalls:0, roleCalls:0, guardRoleCalls:0,
  emit(session, event = session ? 'TOKEN_REFRESHED' : 'SIGNED_OUT') {
    audit.session=session;
    if(session) localStorage.setItem(storageKey,JSON.stringify(session)); else localStorage.removeItem(storageKey);
    for(const listener of listeners) listener(event,session);
  },
  switchUser(){audit.emit(makeSession('regular'));},
};
export function createClient() { return {
 functions:{async invoke(name, options){
   if(name!=='admin-login') throw Error('Unexpected function');
   audit.pinCalls++; await delay();
   if(options.body.pin!==${JSON.stringify(fixturePin)}) {
     const response = new Response(JSON.stringify({code:'invalid_pin'}),{status:401});
     return {data:null,error:new Error('Synthetic invalid PIN'),response};
   }
   return {data:{ok:true,access_token:'synthetic-admin',refresh_token:'synthetic-refresh'},error:null};
 }},
 auth:{
   getSession:async()=>({data:{session:audit.session},error:null}),
   onAuthStateChange:fn=>{listeners.add(fn);return {data:{subscription:{unsubscribe:()=>listeners.delete(fn)}}};},
   getUser:async token=>{audit.userCalls++;await delay();return {data:{user:config.invalidUser?null:{id:token.replace('synthetic-','')}},error:config.invalidUser?new Error('Synthetic invalid identity'):null};},
   signOut:async()=>{audit.emit(null);return {error:null};},
   setSession:async()=>{audit.installs++;audit.emit(makeSession(),'SIGNED_IN');return {error:null};},
 },
 rpc(name){
   if(name!=='is_admin') throw Error('Unexpected RPC');
   audit.roleCalls++;
   let token=audit.session?.access_token;
   let isGuard=false;
   const query={
     setHeader:(_name,value)=>{isGuard=true;audit.guardRoleCalls++;token=value.replace('Bearer ','');return query;},
     abortSignal:()=>query,
     then(resolve,reject){return delay().then(()=>({data:!(isGuard&&config.guardDenies)&&token==='synthetic-admin',error:isGuard&&config.guardError?new Error('Synthetic RPC failure'):null})).then(resolve,reject);}
   };
   return query;
 }
}; }
`;
const entry = `
import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter,Routes,Route,Outlet,useNavigate,useOutletContext} from 'react-router-dom';
import {AuthProvider,useAuth} from './src/context/AuthContext';
import {LanguageProvider} from './src/context/LanguageContext';
import AdminLoginModal from './src/components/AdminLoginModal';
import AdminRoute from './src/components/AdminRoute';
function Layout(){
 const [open,setOpen]=useState(false);const auth=useAuth();const navigate=useNavigate();
 useEffect(()=>{window.audit.auth={loading:auth.loading,fresh:auth.hasFreshPinVerification,isAdmin:auth.isAdmin};},[auth.loading,auth.hasFreshPinVerification,auth.isAdmin]);
 return <><button data-open-pin onClick={()=>{auth.beginAdminPinAttempt();setOpen(true);}}>Open PIN</button>
 <Outlet context={{marker:'inherited-layout'}}/>
 {open&&<AdminLoginModal onClose={()=>setOpen(false)} onSuccess={()=>{setOpen(false);navigate('/admin');}}/>}</>;
}
function Dashboard(){const ctx=useOutletContext();useEffect(()=>{window.audit.mounts++;},[]);return <div data-admin={ctx.marker}>Protected dashboard mounted</div>;}
document.addEventListener('submit',()=>{window.audit.submits++;},true);
createRoot(document.getElementById('root')).render(<LanguageProvider><AuthProvider><HashRouter><Routes><Route element={<Layout/>}><Route path='/' element={<div data-public>Public</div>}/><Route element={<AdminRoute/>}><Route path='/admin' element={<Dashboard/>}/></Route></Route></Routes></HashRouter></AuthProvider></LanguageProvider>);
`;
const bundle = await build({
  stdin:{contents:entry,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',
  define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},
  plugins:[{name:'synthetic-supabase',setup(b){
    b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'sdk',namespace:'audit'}));
    b.onLoad({filter:/.*/,namespace:'audit'},()=>({contents:mock,loader:'js'}));
  }}],
});
const server = createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/test.js') {res.setHeader('Content-Type','application/javascript');res.end(bundle.outputFiles[0].contents);return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');
  const config={guardError:url.searchParams.has('guardError'),guardDenies:url.searchParams.has('guardDenies'),invalidUser:url.searchParams.has('invalidUser')};
  res.end('<div id="root"></div><script>window.auditConfig='+JSON.stringify(config)+'</script><script src="/test.js"></script>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
const results=[];
const pass=name=>{results.push(name);console.log('PASS: '+name);};
try {
  // Default Chrome sandbox stays enabled. Run in an environment that permits
  // Chrome renderer/IPC startup; an OS sandbox failure must fail this suite.
  browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,pipe:true,timeout:15000,protocolTimeout:15000});
  console.log('BROWSER: '+await browser.version());
  const page=await browser.newPage();
  page.setDefaultTimeout(15000);
  const errors=[];
  const blocked=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request',request=>{
    if(new URL(request.url()).origin===origin) void request.continue();
    else {blocked.push(request.url());void request.abort();}
  });
  const waitAuth=()=>page.waitForFunction(()=>window.audit?.auth?.loading===false);
  const noDashboard=async()=>{assert.equal(await page.$('[data-admin]'),null);assert.equal(await page.evaluate(()=>window.audit.mounts),0);};
  const publicOnly=async()=>{await page.waitForSelector('[data-public]');await noDashboard();assert.equal(await page.evaluate(()=>window.audit.auth.fresh),false);};
  const fresh=async(query='')=>{
    await page.goto(origin+'/#/',{waitUntil:'load'});
    await page.evaluate(()=>localStorage.clear()); // This isolated loopback origin only.
    await page.goto(origin+'/'+query+'#/');await waitAuth();
  };
  const openPin=async()=>{await page.click('[data-open-pin]');await page.waitForSelector('input[name="admin-pin"]');};
  const enter=async(value='')=>{await page.focus('input[name="admin-pin"]');if(value)await page.keyboard.type(value);await page.keyboard.press('Enter');};
  const errorShown=()=>page.waitForSelector('form p');

  await fresh();await openPin();await enter();await errorShown();
  assert.equal(await page.evaluate(()=>window.audit.submits),1);
  assert.equal(await page.evaluate(()=>window.audit.pinCalls),0);await noDashboard();
  pass('A. EMPTY PIN + ENTER: denied; form submitted; no login request');

  await enter('000000');await errorShown();
  await page.waitForFunction(()=>window.audit.pinCalls===1&&!document.querySelector('button[type="submit"]').disabled);
  assert.equal(await page.evaluate(()=>window.audit.installs),0);await noDashboard();
  pass('B. WRONG PIN + ENTER: denied; admin-login error; no session installed');

  await fresh();await page.goto(origin+'/#/admin');await waitAuth();await publicOnly();
  pass('C. DIRECT /ADMIN: redirected to public page; zero dashboard mounts');

  await openPin();await enter(fixturePin);await page.waitForSelector('[data-admin]');
  assert.equal(await page.evaluate(()=>location.hash),'#/admin');
  assert.equal(await page.evaluate(()=>window.audit.auth.fresh),true);
  assert.equal(await page.evaluate(()=>window.audit.installs),1);
  assert.ok(await page.evaluate(()=>window.audit.guardRoleCalls>0&&window.audit.userCalls>=2));
  assert.equal(await page.$eval('[data-admin]',el=>el.dataset.admin),'inherited-layout');
  pass('F. CORRECT PIN: real modal/helper/AuthProvider/guard allow entry with synthetic SDK responses');

  await page.reload({waitUntil:'load'});await waitAuth();await publicOnly();
  assert.ok(await page.evaluate(()=>window.audit.session));
  assert.equal(await page.evaluate(()=>window.audit.pinCalls),0);
  pass('D. REFRESH: session persists, fresh PIN proof resets, redirected home; new PIN required');

  await page.goto(origin+'/#/admin');await waitAuth();
  await page.waitForFunction(()=>window.audit.auth.isAdmin===true);await publicOnly();
  assert.ok(await page.evaluate(()=>window.audit.session));
  assert.equal(await page.evaluate(()=>window.audit.pinCalls),0);
  pass('E. OLD ADMIN SESSION: valid simulated admin role/session alone denied without fresh PIN');

  for(const flag of ['guardError','guardDenies']){
    await fresh('?'+flag);await openPin();await enter(fixturePin);
    await page.waitForFunction(()=>window.audit.guardRoleCalls>0);
    await page.waitForFunction(()=>location.hash==='#/'&&!document.querySelector('input[name="admin-pin"]'));
    await noDashboard();
    pass('GUARD '+flag+': denies access even after successful PIN and context role check');
  }
  await fresh('?invalidUser');await openPin();await enter(fixturePin);await errorShown();await noDashboard();
  assert.equal(await page.evaluate(()=>window.audit.auth.fresh),false);
  pass('Invalid Auth identity: fails closed after PIN');

  assert.deepEqual(errors,[], 'No uncaught browser exceptions');
  assert.deepEqual(blocked,[], 'No unexpected external requests (all would be blocked)');
  console.log('Browser regression: '+results.length+'/'+results.length+' PASS; isolated synthetic Auth, no live Supabase requests.');
} finally {
  if(browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
