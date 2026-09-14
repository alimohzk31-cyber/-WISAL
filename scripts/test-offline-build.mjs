import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const scope = 'http://wisal.test/app/';
const source = await readFile('dist/sw.js', 'utf8');
const builtIndex = await readFile('dist/index.html', 'utf8');
const shellUrls = JSON.parse(source.match(/const APP_SHELL = (\[[^;]+\]);/)?.[1] || '[]');
assert.ok(shellUrls.includes('./index.html'));
assert.ok(shellUrls.includes('./manifest.webmanifest'));
assert.match(builtIndex, /id="loading-screen"/, 'first paint must contain a static skeleton before React loads');
await Promise.all(shellUrls.map(url => access(path.join('dist', url.slice(2)))));

const handlers = new Map();
let online = true;
let latency = 0;
let navigationBody = 'installed-shell';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const absolute = input => new URL(typeof input === 'string' ? input : input.url, scope).href;

class MemoryCache {
  entries = new Map();
  async match(input) { return this.entries.get(absolute(input))?.clone(); }
  async put(input, response) { this.entries.set(absolute(input), response.clone()); }
  async delete(input) { return this.entries.delete(absolute(input)); }
  async keys() { return [...this.entries.keys()].map(url => new Request(url)); }
  async add(input) {
    const response = await fakeFetch(input);
    if (!response.ok) throw new Error(`Unable to cache ${absolute(input)}`);
    await this.put(input, response);
  }
}

const stores = new Map();
const cacheStorage = {
  async open(name) { if (!stores.has(name)) stores.set(name, new MemoryCache()); return stores.get(name); },
  async keys() { return [...stores.keys()]; },
  async delete(name) { return stores.delete(name); },
};

async function fakeFetch(input) {
  if (!online) throw new TypeError('offline');
  if (latency) await sleep(latency);
  const url = absolute(input);
  const body = url === scope || url.endsWith('/index.html') ? navigationBody : `asset:${url}`;
  return new Response(body, { status: 200, headers: { 'content-type': 'text/plain' } });
}

function ScopedRequest(input, init) {
  return new Request(typeof input === 'string' ? new URL(input, scope) : input, init);
}
ScopedRequest.prototype = Request.prototype;

const context = vm.createContext({
  self: {
    registration: { scope },
    location: { origin: new URL(scope).origin },
    clients: { claim: async () => undefined },
    skipWaiting: async () => undefined,
    addEventListener(type, listener) { handlers.set(type, listener); },
  },
  caches: cacheStorage,
  fetch: fakeFetch,
  Request: ScopedRequest,
  Response,
  URL,
  Promise,
  setTimeout,
});
vm.runInContext(source, context, { filename: 'dist/sw.js' });

async function dispatchLifecycle(type) {
  let pending = Promise.resolve();
  handlers.get(type)({ waitUntil(value) { pending = Promise.resolve(value); } });
  await pending;
}

async function navigate(profile, delay, isOnline = true) {
  online = isOnline;
  latency = delay;
  navigationBody = `network:${profile}`;
  let responsePromise;
  const background = [];
  handlers.get('fetch')({
    request: { method: 'GET', mode: 'navigate', destination: 'document', url: scope },
    respondWith(value) { responsePromise = Promise.resolve(value); },
    waitUntil(value) { background.push(Promise.resolve(value)); },
  });
  const started = performance.now();
  const response = await responsePromise;
  const elapsedMs = Math.round(performance.now() - started);
  const body = await response.text();
  await Promise.allSettled(background);
  return { profile, elapsedMs, body };
}

await dispatchLifecycle('install');
await cacheStorage.open('wisal-shell-obsolete');
await dispatchLifecycle('activate');
assert.ok(!(await cacheStorage.keys()).includes('wisal-shell-obsolete'), 'old cache must be removed');

const results = [];
results.push(await navigate('Fast 4G', 40));
results.push(await navigate('Slow 3G', 900));
results.push(await navigate('Very weak', 4000));
results.push(await navigate('Offline', 0, false));

assert.match(results[0].body, /Fast 4G/);
assert.match(results[1].body, /Slow 3G/);
assert.ok(results[2].elapsedMs < 3000, 'very weak navigation must fall back to cache before the network finishes');
assert.match(results[3].body, /Very weak/, 'offline navigation must use the last background-refreshed shell');

const sources = await Promise.all([
  readFile('src/hooks/useServices.ts', 'utf8'),
  readFile('src/hooks/useCategories.ts', 'utf8'),
  readFile('src/hooks/useSlider.ts', 'utf8'),
  readFile('src/features/jobs/useJobs.ts', 'utf8'),
]);
assert.ok(sources.every(text => text.includes('APP_ONLINE_EVENT')), 'all public data sources refresh on reconnect');
const querySources = await Promise.all([
  readFile('src/hooks/useStats.ts', 'utf8'),
  readFile('src/hooks/useComments.ts', 'utf8'),
  readFile('src/hooks/useFeedInteractions.ts', 'utf8'),
  readFile('src/hooks/useSuggestionInteractions.ts', 'utf8'),
  readFile('src/features/jobs/useJobPresentation.ts', 'utf8'),
  readFile('src/features/jobs/JobsManager.tsx', 'utf8'),
  readFile('src/features/jobs/admin/jobAdminApi.ts', 'utf8'),
]);
assert.ok(querySources.every(text => !text.includes("select('*')")), 'queries must request explicit columns');
const listColumnsSource = sources[0].match(/const SERVICE_LIST_COLUMNS = \[([\s\S]*?)\]\.join/)?.[1] || '';
assert.ok(listColumnsSource.includes("'id', 'slug', 'title', 'description', 'phone',"));
assert.ok(!listColumnsSource.includes('image_url'), 'service list must not embed media payloads');

console.log(JSON.stringify({
  status: 'PASS',
  precacheFiles: shellUrls.length,
  oldCacheRemoved: true,
  reconnectSources: sources.length,
  profiles: results,
}, null, 2));
