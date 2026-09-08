import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const state = {
  invokeResult: null,
  invokeThrow: null,
  setSessionCalls: 0,
  setSessionError: null,
  lastInvokeArgs: null,
  lastSetSessionArgs: null,
};

const mockSupabase = `
const s = globalThis.__PIN_TEST_STATE;
class FunctionsHttpError extends Error {
  constructor(context) { super('HTTP error', 'FunctionsHttpError'); this.context = context; }
}
function createClient() {
  return {
    functions: {
      async invoke(fnName, opts) {
        s.invokeCalls = (s.invokeCalls || 0) + 1;
        s.lastInvokeArgs = { fnName, opts };
        if (s.invokeThrow) throw new Error(s.invokeThrow);
        if (s.invokeResult) return s.invokeResult;
        return { data: null, error: null, response: undefined };
      },
    },
    auth: {
      async setSession(tokens) {
        s.lastSetSessionArgs = tokens;
        s.setSessionCalls++;
        if (s.setSessionError) return { error: s.setSessionError };
        return { error: null };
      },
    },
  };
}
module.exports = { createClient, FunctionsHttpError };
`;

async function main() {
  const entryPath = path.join(__dirname, 'test-admin-pin-entry.ts');
  const entryContent = require('node:fs').readFileSync(entryPath, 'utf8');

  const bundle = await build({
    stdin: { contents: entryContent, resolveDir: __dirname, loader: 'ts' },
    bundle: true, write: false, format: 'cjs', platform: 'node',
    define: { 'import.meta.env': 'process.env' },
    plugins: [{
      name: 'mock-supabase',
      setup(b) {
        b.onResolve({ filter: /@supabase\/supabase-js/ }, () => ({ path: 'mock-supabase-js', namespace: 'mock' }));
        b.onLoad({ filter: /^mock-supabase-js$/, namespace: 'mock' }, () => ({ contents: mockSupabase, loader: 'js' }));
      },
    }],
  });

  globalThis.__PIN_TEST_STATE = state;
  let store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };

  // Write bundle to temp file and run it directly
  const tmpFile = path.join(tmpdir(), 'test-admin-pin-bundle.cjs');
  writeFileSync(tmpFile, bundle.outputFiles[0].text, 'utf8');
  
  // Import the bundle
  await import('file://' + tmpFile);
  
  // Cleanup
  try { unlinkSync(tmpFile); } catch {}

  return new Promise((resolve) => {
    setTimeout(() => {
      const results = globalThis.__TEST_RESULTS__;
      if (results && results.failed > 0) {
        console.log('\n' + results.failed + ' test(s) FAILED');
        process.exit(1);
      } else {
        console.log('\nAll ' + (results?.total || 0) + ' test(s) PASSED');
        process.exit(0);
      }
    }, 5000);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
