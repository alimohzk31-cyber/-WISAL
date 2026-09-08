// Local integration test: real production UI, isolated Chrome profile, mocked
// Supabase responses. No requests or mutations reach the production database.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const html = await readFile('dist/index.html');
const server = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(path.join(tmpdir(), 'saleen-notifications-test-'));
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
  const debuggerUrl = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Chrome startup timed out')), 20000);
    chrome.once('error', reject);
    chrome.stderr.on('data', data => {
      output += data;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  console.log('Chrome started.');
  const debugOrigin = debuggerUrl.replace(/^ws:/, 'http:').split('/devtools/')[0];
  const target = await fetch(`${debugOrigin}/json/new?about:blank`, { method: 'PUT', signal: AbortSignal.timeout(10000) }).then(res => res.json());
  console.log('Test tab created.');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Chrome connection timed out')), 10000);
    socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Chrome connection failed')); }, { once: true });
  });
  console.log('Chrome connected.');
  let sequence = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 15000);
    pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const notification = (index, published = true) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    title: `إشعار الإدارة ${index}`,
    message: ('رسالة إدارية للاختبار وقراءة التفاصيل كاملة. ').repeat(8),
    created_at: '2026-09-05T08:00:00Z',
    published_at: published ? '2026-09-05T09:00:00Z' : null,
  });
  let rows = Array.from({ length: 6 }, (_, index) => notification(index + 1));
  let failNotifications = false;
  let admin = false;
  let authRequests = 0;
  let mutationRequests = 0;
  let listRequests = 0;
  const errors = [];
  const intercept = async event => {
    const { requestId, request } = event.params;
    const url = new URL(request.url);
    if (url.origin === origin) { await send('Fetch.continueRequest', { requestId }); return; }
    let body = [];
    let responseCode = 200;
    if (request.method === 'OPTIONS') {
      responseCode = 204;
    } else if (url.pathname.endsWith('/admin_notifications')) {
      listRequests++;
      if (failNotifications) { responseCode = 503; body = { message: 'Test offline' }; }
      else if (request.method === 'GET') {
        if (url.searchParams.get('published_at') === 'not.is.null') body = rows.filter(row => row.published_at);
        else { assert.equal(admin, true, 'draft reads must require an admin'); body = rows; }
      } else {
        mutationRequests++;
        assert.equal(admin, true, 'writes must require an admin');
        if (request.method === 'POST') {
          body = { ...notification(200 + mutationRequests), ...JSON.parse(request.postData) };
          rows.unshift(body);
        } else {
          const id = url.searchParams.get('id')?.replace('eq.', '');
          const item = rows.find(row => row.id === id);
          assert.ok(item, 'mutation must target an existing row');
          if (request.method === 'PATCH') Object.assign(item, JSON.parse(request.postData));
          else if (request.method === 'DELETE') rows = rows.filter(row => row.id !== id);
          body = item;
        }
      }
    } else if (url.pathname.endsWith('/rpc/is_admin')) body = admin;
    else if (url.pathname.includes('/auth/v1/')) {
      authRequests++;
      if (url.pathname.endsWith('/token') && admin) {
        const now = Math.floor(Date.now() / 1000);
        const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', aud: 'authenticated', role: 'authenticated', email: 'admin@example.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
        const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
        const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 })}.test-signature`;
        body = { access_token, refresh_token: 'local-test-only', expires_in: 3600, expires_at: now + 3600, token_type: 'bearer', user };
      } else if (url.pathname.endsWith('/logout')) { responseCode = 204; admin = false; }
      else { responseCode = 400; body = { message: 'Test account rejected' }; }
    }
    else if (url.pathname.endsWith('/stats')) body = [];
    await send('Fetch.fulfillRequest', {
      requestId, responseCode,
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Access-Control-Allow-Origin', value: '*' },
        { name: 'Access-Control-Allow-Headers', value: '*' },
        { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, DELETE, OPTIONS' },
      ], body: Buffer.from(JSON.stringify(body)).toString('base64'),
    });
  };
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const promise = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) promise?.reject(new Error(message.error.message));
      else promise?.resolve(message.result);
    } else if (message.method === 'Fetch.requestPaused') {
      intercept(message).catch(error => errors.push(error.message));
    } else if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    } else if (message.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: true }).catch(error => errors.push(error.message));
    }
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 1, mobile: true });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(`${result.exceptionDetails.exception?.description || result.exceptionDetails.text}\nExpression: ${expression}`);
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log('Browser errors:', errors);
    console.log('Notification requests:', listRequests);
    console.log('Auth requests:', authRequests);
    console.log('Menu:', await evaluate('document.querySelector("#main-menu")?.textContent'));
    console.log('Visible form:', await evaluate('document.querySelector("input[type=email]")?.closest("form")?.textContent'));
    throw new Error(`Timed out: ${expression}`);
  };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const screenshot = async name => {
    await mkdir('release/notifications-qa', { recursive: true });
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`release/notifications-qa/${name}.png`, Buffer.from(data, 'base64'));
  };
  await send('Page.navigate', { url: origin });
  console.log('Production page opened.');
  await waitFor('!!document.querySelector("[aria-controls=main-menu]")');
  await click('[aria-controls=main-menu]');
  await waitFor('document.querySelector("#main-menu [aria-haspopup=dialog]")?.getAttribute("aria-label").includes("6")');
  assert.equal(await evaluate('document.querySelectorAll("header .lucide-bell").length'), 1);
  assert.equal(await evaluate('document.querySelector("#main-menu").getBoundingClientRect().width'), 240);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await screenshot('mobile-menu');
  await click('#main-menu [aria-haspopup=dialog]');
  await waitFor('document.querySelectorAll("[data-notification-id]").length === 6');
  await waitFor('JSON.parse(localStorage.getItem("saleen:notifications:read:v1") || "[]").length > 0');
  assert.equal(await evaluate('!!document.querySelector("[role=dialog] input, [role=dialog] textarea, [role=dialog] form")'), false);
  assert.equal(await evaluate('document.querySelector("[role=dialog]").getBoundingClientRect().width <= innerWidth'), true);
  const firstRead = await evaluate('JSON.parse(localStorage.getItem("saleen:notifications:read:v1")).length');
  assert.ok(firstRead < 6, 'offscreen notifications must stay unread');
  await screenshot('mobile-popup');
  console.log('Mobile menu and popup checked.');
  for (let index = 0; index < 6; index++) {
    await evaluate(`document.querySelectorAll('[data-notification-id]')[${index}].scrollIntoView({block:'center'})`);
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  await waitFor('JSON.parse(localStorage.getItem("saleen:notifications:read:v1")).length === 6');
  await click('[aria-label="إغلاق الإشعارات"]');
  await click('[aria-controls=main-menu]');
  assert.equal(await evaluate('document.querySelector("#main-menu [aria-haspopup=dialog]").getAttribute("aria-label")'), 'الإشعارات');
  await send('Page.reload');
  await waitFor('!!document.querySelector("[aria-controls=main-menu]")');
  await click('[aria-controls=main-menu]');
  await waitFor('!!document.querySelector("#main-menu [aria-haspopup=dialog]")');
  assert.equal(await evaluate('document.querySelector("#main-menu [aria-haspopup=dialog]").getAttribute("aria-label")'), 'الإشعارات');
  rows.unshift(notification(7), notification(8, false));
  await evaluate('window.dispatchEvent(new Event("focus"))');
  await waitFor('document.querySelector("#main-menu [aria-haspopup=dialog]")?.getAttribute("aria-label").includes("1")');
  rows = rows.filter(row => row.id !== notification(7).id);
  await evaluate('window.dispatchEvent(new Event("focus"))');
  await waitFor('document.querySelector("#main-menu [aria-haspopup=dialog]")?.getAttribute("aria-label") === "الإشعارات"');
  failNotifications = true;
  await click('#main-menu [aria-haspopup=dialog]');
  await waitFor('!!document.querySelector("[role=dialog] [role=alert]")');
  failNotifications = false;
  rows = [];
  await click('[role=alert] button');
  await waitFor('document.querySelector("[role=dialog]")?.textContent.includes("لا توجد إشعارات جديدة")');
  await click('[aria-label="إغلاق الإشعارات"]');
  rows = Array.from({ length: 105 }, (_, index) => notification(index + 10));
  await evaluate('window.dispatchEvent(new Event("focus"))');
  await click('[aria-controls=main-menu]');
  await waitFor('document.querySelector("#main-menu [aria-haspopup=dialog]")?.getAttribute("aria-label").includes("105")');
  assert.equal(await evaluate('document.querySelector("#main-menu [aria-haspopup=dialog]").textContent.includes("99+")'), true);
  for (const width of [320, 1280]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 600 });
    await new Promise(resolve => setTimeout(resolve, 300));
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    assert.equal(await evaluate('Math.round(document.querySelector("#main-menu").getBoundingClientRect().width)'), 240);
    await screenshot(`menu-${width}`);
  }
  rows = [];
  await click('[aria-controls=main-menu]');
  await evaluate('location.hash = "#/admin"');
  // Wait for the existing route exit/entry animation before interacting.
  await new Promise(resolve => setTimeout(resolve, 800));
  await waitFor('[...document.querySelectorAll("button")].some(button => button.textContent.trim() === "إدارة الإشعارات")');
  await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.trim() === "إدارة الإشعارات").click()');
  await waitFor('!!document.querySelector("input[type=email]")');
  assert.equal(await evaluate('[...document.querySelectorAll("button")].some(button => button.textContent.trim() === "إرسال للجميع")'), false);
  assert.equal(mutationRequests, 0);
  assert.equal(authRequests, 0, 'opening admin section must not create/login an account');
  admin = true;
  await new Promise(resolve => setTimeout(resolve, 300));
  for (const [selector, text] of [['input[type=email]', 'admin@example.test'], ['input[type=password]', 'local-test-password']]) {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    await send('Input.insertText', { text });
  }
  await evaluate('document.querySelector("input[type=email]").closest("form").requestSubmit()');
  await waitFor('[...document.querySelectorAll("button")].some(button => button.textContent.trim() === "إرسال للجميع")');
  await waitFor('![...document.querySelectorAll("button")].find(button => button.textContent.trim() === "إرسال للجميع").disabled');
  const fillNotification = async title => evaluate(`(() => {
    const input = document.querySelector('section form input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(title)});
    input.dispatchEvent(new Event('input', {bubbles:true}));
    const textarea = document.querySelector('section form textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'تفاصيل إشعار الإدارة للاختبار');
    textarea.dispatchEvent(new Event('input', {bubbles:true}));
  })()`);
  await fillNotification('مسودة إدارية');
  await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.trim() === "حفظ مسودة").click()');
  await waitFor('document.querySelector("section article")?.textContent.includes("مسودة إدارية")');
  assert.equal(rows[0].published_at, null);
  await evaluate('[...document.querySelectorAll("section article button")].find(button => button.textContent.trim() === "إرسال").click()');
  await waitFor('document.querySelector("section article")?.textContent.includes("تم الإرسال")');
  assert.ok(rows[0].published_at);
  await evaluate('[...document.querySelectorAll("section article button")].find(button => button.textContent.trim() === "حذف").click()');
  await waitFor('document.querySelector("section")?.textContent.includes("تم حذف الإشعار.")');
  assert.equal(rows.length, 0);
  await fillNotification('إرسال مباشر');
  await evaluate('document.querySelector("section form").requestSubmit()');
  await waitFor('document.querySelector("section article")?.textContent.includes("إرسال مباشر")');
  assert.ok(rows[0].published_at);
  await screenshot('admin-notifications');
  await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent.trim() === "تسجيل الخروج").click()');
  await waitFor('!!document.querySelector("input[type=email]")');
  assert.equal(await evaluate('!!document.querySelector("section form textarea")'), false);
  assert.equal(mutationRequests, 4);
  assert.deepEqual(errors, []);
  console.log('PASS: mobile/desktop layout, single bell, 99+ badge, visible-only reading, persistence, new/deleted notifications, hidden drafts, error/retry/empty state, admin gate, login, draft/create/publish/delete/logout. All API responses mocked; zero production writes.');
  console.log(`Public notification requests checked: ${listRequests}`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  chrome.kill();
  await Promise.race([new Promise(resolve => chrome.exitCode !== null ? resolve() : chrome.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))]);
  server.close();
  // Resolve and verify the disposable profile stays within the temp directory.
  const tempRoot = path.resolve(tmpdir());
  const resolvedProfile = path.resolve(profile);
  if (path.dirname(resolvedProfile) === tempRoot && path.basename(resolvedProfile).startsWith('saleen-notifications-test-')) {
    await rm(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
