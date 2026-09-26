// Test entry: bundled by esbuild and run in vm context
import { adminPinLogin, isPinRateLimited, getPinRateLimitRemainingMs, clearPinRateLimit } from '../src/lib/supabase';

const s = (globalThis as any).__PIN_TEST_STATE as {
  invokeResult: any; invokeThrow: string | null; setSessionCalls: number;
  setSessionError: any; lastInvokeArgs: any; lastSetSessionArgs: any;
  signOutCalls: number; signOutError: any;
  invokeCalls?: number;
};

function makeResponse(status: number, body: any, retryAfter?: number) {
  const headers = new Map<string, string>();
  if (retryAfter !== undefined) headers.set('retry-after', String(retryAfter));
  return {
    status,
    headers: { get: (k: string) => headers.get(k.toLowerCase()) || null },
    clone: () => ({ json: async () => body, text: async () => JSON.stringify(body) }),
    json: async () => body, text: async () => JSON.stringify(body),
  };
}

function makeHttpError(response: any) {
  const err = new Error('HTTP error');
  err.name = 'FunctionsHttpError';
  (err as any).context = response;
  return err;
}

function resetState() {
  s.invokeResult = null; s.invokeThrow = null; s.setSessionCalls = 0;
  s.setSessionError = null; s.lastInvokeArgs = null; s.lastSetSessionArgs = null;
  s.signOutCalls = 0; s.signOutError = null;
  localStorage.clear();
}

const results: Array<{ name: string; passed: boolean; detail?: string }> = [];
function report(name: string, passed: boolean, detail?: string) {
  results.push({ name, passed, detail });
  console.log((passed ? 'PASS: ' : 'FAIL: ') + name + (detail ? ' - ' + detail : ''));
}

async function run() {
  // Test 0: Empty and whitespace-only PINs never call the Edge Function.
  try {
    const cases = ['', '   ', '\t\n'];
    for (const value of cases) {
      resetState();
      const invokeCallsBefore = s.invokeCalls || 0;
      const r = await adminPinLogin(value);
      if (r.ok !== false || r.code !== 'invalid_pin' || (s.invokeCalls || 0) !== invokeCallsBefore || s.setSessionCalls !== 0) {
        throw new Error(`Empty PIN case failed: result=${JSON.stringify(r)} invokeCalls=${s.invokeCalls || 0}`);
      }
    }
    report('0. Empty and whitespace-only PINs rejected locally without request', true);
  } catch (e: any) { report('0. Empty and whitespace-only PINs rejected locally without request', false, e.message); }

  // Test 1: Correct PIN within limit
  try {
    resetState();
    s.invokeResult = { data: { ok: true, access_token: 'tok_abc', refresh_token: 'ref_def' }, error: null, response: undefined };
    const r = await adminPinLogin('1234');
    if (r.ok === true && s.signOutCalls === 1 && s.setSessionCalls === 1 && s.lastSetSessionArgs.access_token === 'tok_abc') {
      report('1. Correct PIN within limit', true);
    } else {
      report('1. Correct PIN within limit', false, JSON.stringify(r) + ' setSessionCalls=' + s.setSessionCalls);
    }
  } catch (e: any) { report('1. Correct PIN within limit', false, e.message); }

  // Test 2: Wrong PIN
  try {
    resetState();
    const fakeResponse = makeResponse(401, { code: 'invalid_pin' });
    s.invokeResult = { data: null, error: makeHttpError(fakeResponse), response: fakeResponse };
    const r = await adminPinLogin('wrongpin');
    if (r.ok === false && r.code === 'invalid_pin' && s.signOutCalls === 1 && s.setSessionCalls === 0) {
      report('2. Wrong PIN rejected', true);
    } else {
      report('2. Wrong PIN rejected', false, JSON.stringify(r) + ' setSessionCalls=' + s.setSessionCalls);
    }
  } catch (e: any) { report('2. Wrong PIN rejected', false, e.message); }

  // Test 2b: Repeated wrong PINs never install or preserve an admin session.
  try {
    resetState();
    const fakeResponse = makeResponse(401, { code: 'invalid_pin' });
    s.invokeResult = { data: null, error: makeHttpError(fakeResponse), response: fakeResponse };
    const attempts = await Promise.all(Array.from({ length: 5 }, () => adminPinLogin('wrong-pin')));
    if (attempts.every(r => r.ok === false && r.code === 'invalid_pin') && s.setSessionCalls === 0) {
      report('2b. Repeated wrong PINs stay denied without session', true);
    } else {
      report('2b. Repeated wrong PINs stay denied without session', false, JSON.stringify(attempts));
    }
  } catch (e: any) { report('2b. Repeated wrong PINs stay denied without session', false, e.message); }

  // Test 3: 429 received -> immediate stop, no session
  try {
    resetState();
    const fakeResponse = makeResponse(429, { code: 'rate_limited' }, 900);
    s.invokeResult = { data: null, error: makeHttpError(fakeResponse), response: fakeResponse };
    const r = await adminPinLogin('anything');
    const banned = isPinRateLimited();
    const remaining = getPinRateLimitRemainingMs();
    if (r.ok === false && r.code === 'rate_limited' && s.setSessionCalls === 0 && banned && remaining > 0) {
      report('3. 429 immediate stop, local ban set, no session', true);
    } else {
      report('3. 429 immediate stop', false, JSON.stringify(r) + ' banned=' + banned + ' remaining=' + remaining);
    }
  } catch (e: any) { report('3. 429 immediate stop', false, e.message); }

  // Test 4: Correct PIN during ban -> still blocked (no server call)
  try {
    resetState();
    const fake429 = makeResponse(429, { code: 'rate_limited' }, 900);
    s.invokeResult = { data: null, error: makeHttpError(fake429), response: fake429 };
    const r1 = await adminPinLogin('trigger_ban');
    if (r1.ok !== false || r1.code !== 'rate_limited') {
      throw new Error('Failed to trigger ban: ' + JSON.stringify(r1));
    }
    const invokeCallsBefore = s.invokeCalls || 0;
    s.invokeResult = { data: { ok: true, access_token: 'tok_after_ban', refresh_token: 'ref_after_ban' }, error: null, response: undefined };
    const r2 = await adminPinLogin('correct_pin_while_banned');
    const invokeCallsAfter = s.invokeCalls || 0;
    if (r2.ok === false && r2.code === 'rate_limited' && s.setSessionCalls === 0 && invokeCallsAfter === invokeCallsBefore) {
      report('4. Correct PIN during ban blocked (no server call)', true);
    } else {
      report('4. Correct PIN during ban blocked', false, JSON.stringify(r2) + ' setSessionCalls=' + s.setSessionCalls + ' serverCalled=' + (invokeCallsAfter > invokeCallsBefore));
    }
  } catch (e: any) { report('4. Correct PIN during ban blocked', false, e.message); }

  // Test 5: After ban expires -> new attempt allowed
  try {
    resetState();
    const fake429 = makeResponse(429, { code: 'rate_limited' }, 1);
    s.invokeResult = { data: null, error: makeHttpError(fake429), response: fake429 };
    await adminPinLogin('trigger_ban');
    await new Promise(res => setTimeout(res, 1100));
    if (isPinRateLimited()) {
      report('5. After ban expires', false, 'Local ban did not expire');
    } else {
      s.invokeResult = { data: { ok: true, access_token: 'tok_after_expiry', refresh_token: 'ref_after' }, error: null, response: undefined };
      const r = await adminPinLogin('correct_after_expiry');
      if (r.ok === true && s.setSessionCalls === 1) {
        report('5. After ban expires -> new attempt allowed', true);
      } else {
        report('5. After ban expires', false, JSON.stringify(r) + ' setSessionCalls=' + s.setSessionCalls);
      }
    }
  } catch (e: any) { report('5. After ban expires', false, e.message); }

  // Test 6: Network error -> blocked, no session
  try {
    resetState();
    s.invokeResult = { data: null, error: new Error('Failed to fetch'), response: undefined };
    const r = await adminPinLogin('1234');
    if (r.ok === false && r.code === 'network' && s.setSessionCalls === 0) {
      report('6. Network error blocked, no session', true);
    } else {
      report('6. Network error blocked', false, JSON.stringify(r) + ' setSessionCalls=' + s.setSessionCalls);
    }
  } catch (e: any) { report('6. Network error blocked', false, e.message); }

  // Test 6b: Thrown error -> blocked
  try {
    resetState();
    s.invokeThrow = 'Unexpected crash';
    const r = await adminPinLogin('1234');
    if (r.ok === false && r.code === 'network' && s.setSessionCalls === 0) {
      report('6b. Thrown error blocked, no session', true);
    } else {
      report('6b. Thrown error blocked', false, JSON.stringify(r));
    }
  } catch (e: any) { report('6b. Thrown error blocked', false, e.message); }

  // Test 7: Server 500 -> blocked, no session
  try {
    resetState();
    const fake500 = makeResponse(500, { code: 'server_error' });
    s.invokeResult = { data: null, error: makeHttpError(fake500), response: fake500 };
    const r = await adminPinLogin('1234');
    if (r.ok === false && s.setSessionCalls === 0) {
      report('7. Server 500 blocked, no session', true);
    } else {
      report('7. Server 500 blocked', false, JSON.stringify(r) + ' setSessionCalls=' + s.setSessionCalls);
    }
  } catch (e: any) { report('7. Server 500 blocked', false, e.message); }

  // Test 8: 429 never produces a session
  try {
    resetState();
    const fake429 = makeResponse(429, { code: 'rate_limited' }, 900);
    s.invokeResult = { data: null, error: makeHttpError(fake429), response: fake429 };
    const r = await adminPinLogin('any');
    if (r.ok === false && r.code === 'rate_limited' && s.setSessionCalls === 0 && s.lastSetSessionArgs === null) {
      report('8. 429 never produces a session', true);
    } else {
      report('8. 429 never produces a session', false, JSON.stringify(r) + ' setSessionCalls=' + s.setSessionCalls);
    }
  } catch (e: any) { report('8. 429 never produces a session', false, e.message); }

  // Test 9: Re-ban after ban cleared + successful login
  try {
    resetState();
    const fake429a = makeResponse(429, { code: 'rate_limited' }, 900);
    s.invokeResult = { data: null, error: makeHttpError(fake429a), response: fake429a };
    await adminPinLogin('trigger1');
    clearPinRateLimit();
    if (isPinRateLimited()) throw new Error('Ban not cleared');
    s.invokeResult = { data: { ok: true, access_token: 'tok', refresh_token: 'ref' }, error: null, response: undefined };
    const success = await adminPinLogin('correct');
    if (!success.ok) throw new Error('Login failed');
    const fake429b = makeResponse(429, { code: 'rate_limited' }, 900);
    s.invokeResult = { data: null, error: makeHttpError(fake429b), response: fake429b };
    const r = await adminPinLogin('trigger2');
    if (r.ok === false && r.code === 'rate_limited' && isPinRateLimited()) {
      report('9. Re-ban after ban cleared', true);
    } else {
      report('9. Re-ban after ban cleared', false, JSON.stringify(r));
    }
  } catch (e: any) { report('9. Re-ban after ban cleared', false, e.message); }

  // Test 10: Tokens alone are not an explicit server success.
  try {
    resetState();
    s.invokeResult = { data: { access_token: 'untrusted', refresh_token: 'untrusted-refresh' }, error: null, response: undefined };
    const r = await adminPinLogin('anything');
    if (r.ok === false && r.code === 'server_error' && s.setSessionCalls === 0) {
      report('10. Missing explicit ok=true is rejected', true);
    } else {
      report('10. Missing explicit ok=true is rejected', false, JSON.stringify(r) + ' setSessionCalls=' + s.setSessionCalls);
    }
  } catch (e: any) { report('10. Missing explicit ok=true is rejected', false, e.message); }

  // Test 11: If the stale local session cannot be cleared, do not call the server.
  try {
    resetState();
    const invokeCallsBefore = s.invokeCalls || 0;
    s.signOutError = new Error('Synthetic local sign-out failure');
    s.invokeResult = { data: { ok: true, access_token: 'must-not-install', refresh_token: 'must-not-install' }, error: null, response: undefined };
    const r = await adminPinLogin('anything');
    const invokeCallsAfter = s.invokeCalls || 0;
    if (r.ok === false && r.code === 'session_clear_failed' && s.setSessionCalls === 0 && invokeCallsAfter === invokeCallsBefore) {
      report('11. Stale session clear failure blocks login', true);
    } else {
      report('11. Stale session clear failure blocks login', false, JSON.stringify(r));
    }
  } catch (e: any) { report('11. Stale session clear failure blocks login', false, e.message); }

  const passCount = results.filter(x => x.passed).length;
  const failCount = results.filter(x => !x.passed).length;
  console.log('\n=== SUMMARY ===');
  console.log('Passed: ' + passCount + ' / ' + results.length);
  console.log('Failed: ' + failCount + ' / ' + results.length);
  if (failCount > 0) {
    console.log('\nFailed tests:');
    results.filter(x => !x.passed).forEach(r => console.log('  - ' + r.name + (r.detail ? ' - ' + r.detail : '')));
  }
  (globalThis as any).__TEST_RESULTS__ = { total: results.length, passed: passCount, failed: failCount };
}

void run();
