// Opt in with sessionStorage.setItem('admin_performance', '1'), then reload.
// Only fixed operation names, durations and outcomes are retained; never credentials/rows.
type Sample = { step: string; ms: number; outcome: 'ok' | 'error' };
const samples: Sample[] = [];
function enabled() {
  try { return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('admin_performance') === '1'; }
  catch { return false; }
}
export function startAdminTiming(step: string) {
  if (!enabled()) return (_outcome: Sample['outcome'] = 'ok') => {};
  const start = performance.now();
  return (outcome: Sample['outcome'] = 'ok') => {
    const sample = { step, ms: Math.round((performance.now() - start) * 10) / 10, outcome };
    samples.push(sample);
    if (samples.length > 200) samples.shift();
    console.info('[AdminPerformance]', sample);
  };
}
export async function measureAdminOperation<T>(step: string, operation: () => PromiseLike<T>): Promise<T> {
  const end = startAdminTiming(step);
  try {
    const result = await operation();
    end(result && typeof result === 'object' && 'error' in result && result.error ? 'error' : 'ok');
    return result;
  } catch (error) { end('error'); throw error; }
}
export function getAdminPerformanceSamples() { return samples.map(sample => ({ ...sample })); }

// Public reads must never keep an empty/skeleton screen waiting indefinitely.
// Writes and uploads are deliberately excluded because aborting them can leave
// their outcome ambiguous to the user.
export const SUPABASE_READ_TIMEOUT_MS = 8_000;

// Observe the unchanged AdminRoute's network requests without altering its checks.
export const adminTimedFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const path = new URL(url).pathname;
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const step = path.endsWith('/auth/v1/user') ? 'network.getUser'
    : path.endsWith('/rpc/is_admin') ? 'network.is_admin' : null;
  const controller = method === 'GET' ? new AbortController() : null;
  const sourceSignal = init?.signal || (input instanceof Request ? input.signal : undefined);
  const relayAbort = () => controller?.abort(sourceSignal?.reason);
  if (sourceSignal?.aborted) relayAbort();
  else sourceSignal?.addEventListener('abort', relayAbort, { once: true });
  const timer = controller ? setTimeout(() => controller.abort(new DOMException('Supabase read timed out', 'TimeoutError')), SUPABASE_READ_TIMEOUT_MS) : undefined;
  const timedInit = controller ? { ...init, signal: controller.signal } : init;
  if (!step) {
    try { return await fetch(input, timedInit); }
    finally {
      if (timer) clearTimeout(timer);
      sourceSignal?.removeEventListener('abort', relayAbort);
    }
  }
  const end = startAdminTiming(step);
  try { const response = await fetch(input, timedInit); end(response.ok ? 'ok' : 'error'); return response; }
  catch (error) { end('error'); throw error; }
  finally {
    if (timer) clearTimeout(timer);
    sourceSignal?.removeEventListener('abort', relayAbort);
  }
};
