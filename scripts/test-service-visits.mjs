// Isolated tests of the real hook with simulated React lifecycle and RPC.
// No network calls; these do not verify the deployed SQL or browser behavior.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { test } from 'node:test';

const source = fs.readFileSync(new URL('../src/hooks/useServiceVisits.ts', import.meta.url), 'utf8');
let entrySequence = 0;
function mount({ service, routeId = String(service.id), entryKey = `entry-${++entrySequence}`, rpc, enabled = true }) {
  let effect, cleanup, state, ref;
  const code = ts.transpileModule(source.replace('(import.meta as any).env.VITE_SERVICE_VIEWS_RPC_ENABLED', JSON.stringify(String(enabled))), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    setTimeout,
    clearTimeout,
    exports, console: { warn() {} },
    require(name) {
      if (name === 'react') return {
        useRef(initial) { return ref ??= { current: initial }; },
        useState() { return [state, value => { state = value; }]; },
        useEffect(callback) { effect = callback; },
      };
      if (name === 'react-router-dom') return {
        useLocation: () => ({ key: entryKey }),
        useMatch: () => routeId === null ? null : { params: { serviceId: routeId } },
      };
      if (name === '../lib/supabase') return { supabase: { rpc } };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  const render = () => exports.useServiceVisits(service);
  render();
  return {
    render,
    enter() { cleanup = effect(); },
    leave() { cleanup?.(); },
    async settle() { await new Promise(resolve => setImmediate(resolve)); },
  };
}

const service = { id: 1250, status: 'approved', views: 20 };
function fakeDatabase() {
  const counts = new Map([[1250, 20], [42, 100]]);
  const calls = [];
  return { counts, calls, rpc: async (name, args) => {
    assert.equal(name, 'increment_service_views');
    assert.equal(Object.keys(args).join(','), 'p_service_id');
    calls.push(args.p_service_id);
    const value = (counts.get(args.p_service_id) ?? 0) + 1;
    counts.set(args.p_service_id, value);
    return { data: value, error: null };
  } };
}

test('three entries count three; a fresh mount simulating Refresh counts one more', async () => {
  const db = fakeDatabase();
  for (let entry = 0; entry < 3; entry++) {
    const detail = mount({ service, rpc: db.rpc });
    detail.enter();
    // StrictMode cleanup/setup must share the same in-flight request.
    detail.leave();
    detail.enter();
    await detail.settle();
    assert.equal(detail.render(), 21 + entry);
    detail.leave();
  }
  assert.equal(db.counts.get(1250), 23);
  const refresh = mount({ service, rpc: db.rpc });
  refresh.enter();
  await refresh.settle();
  assert.equal(refresh.render(), 24);
  assert.equal(db.calls.length, 4);
});

test('different service IDs use independent counters and show the returned value', async () => {
  const db = fakeDatabase();
  const first = mount({ service, rpc: db.rpc });
  const second = mount({ service: { ...service, id: 42, views: 100 }, rpc: db.rpc });
  first.enter(); second.enter();
  await Promise.all([first.settle(), second.settle()]);
  assert.equal(first.render(), 21);
  assert.equal(second.render(), 101);
});

test('non-approved services, cards, wrong routes, invalid IDs and disabled RPC never send visits', async () => {
  const db = fakeDatabase();
  for (const options of [
    ...['pending', 'rejected', 'archived', 'deleted'].map(status => ({ service: { ...service, status } })),
    { service, routeId: null }, { service, routeId: '42' }, { service, enabled: false },
    { service: { ...service, id: undefined } }, { service: { ...service, id: 'slug' } },
  ]) {
    const detail = mount({ ...options, rpc: db.rpc });
    detail.enter();
    await detail.settle();
  }
  assert.equal(db.calls.length, 0);
});

test('an RPC failure is not retried and does not invent an increased count', async () => {
  let calls = 0;
  const detail = mount({ service, rpc: async () => { calls++; throw new Error('lost response'); } });
  detail.enter();
  await detail.settle();
  detail.leave(); detail.enter();
  await detail.settle();
  assert.equal(detail.render(), 20);
  assert.equal(calls, 1);
});
