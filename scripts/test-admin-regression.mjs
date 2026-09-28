import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function source(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function contract(name, text, pattern) {
  assert.match(text, pattern, `${name} contract is missing`);
  console.log(`PASS: ${name}`);
}

function runExistingTest(relativePath, name, nodeArgs = []) {
  const result = spawnSync(process.execPath, [...nodeArgs, path.join(root, relativePath)], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  assert.equal(result.status, 0, `${name} failed with exit code ${result.status}`);
  console.log(`PASS: ${name}`);
}

// Reuse the established behavior suites; do not duplicate their PIN cases.
runExistingTest('scripts/test-admin-pin.mjs', 'Existing admin PIN suite');
runExistingTest(
  'scripts/test-admin-edge-pin.ts',
  'Existing PIN comparison suite',
  ['--require', path.join(root, 'scripts/node-os-userinfo-shim.cjs'), '--import', 'tsx', '--test'],
);
runExistingTest('scripts/test-admin-route.mjs', 'Admin PIN and AdminRoute browser regression');

const app = source('src/App.tsx');
const modal = source('src/components/AdminLoginModal.tsx');
const route = source('src/components/AdminRoute.tsx');
const auth = source('src/context/AuthContext.tsx');
const client = source('src/lib/supabase.ts');
const edge = source('supabase/functions/admin-login/index.ts');
const sql = source('supabase_admin_security_hardening.sql');

contract(
  'Direct /admin route remains under AdminRoute',
  app,
  /<Route element=\{<AdminRoute\s*\/\s*>\}>[\s\S]*?<Route path="admin"[\s\S]*?<AdminDashboard\s*\/\s*>/,
);
contract(
  'Empty PIN is denied before the network call',
  modal,
  /submittedPin\s*===\s*''\s*\|\|\s*!pinInputInteracted\.current/,
);
contract(
  'Enter uses the guarded form submit path',
  modal,
  /<form[\s\S]*onSubmit=\{handleSubmit\}[\s\S]*type="submit"/,
);
contract(
  'AdminRoute requires a fresh PIN verification',
  route,
  /!hasFreshPinVerification[\s\S]*<Navigate to="\/" replace \/>/,
);
contract(
  'AdminRoute validates the live Supabase identity',
  route,
  /supabase\.auth\.getUser\(token\)[\s\S]*data\.user\?\.id\s*!==\s*userId/,
);
contract(
  'AdminRoute fails closed on is_admin failure',
  route,
  /supabase\.rpc\('is_admin'\)[\s\S]*role\.error\s*\|\|\s*role\.data\s*!==\s*true/,
);
contract(
  'AdminRoute deny path closes the route',
  route,
  /setVerification\(\{ key, allowed: false \}\)/,
);
contract(
  'PIN verification uses admin-login only',
  client,
  /supabase\.functions\.invoke<[^>]+>\('admin-login'/,
);
contract(
  'PIN session is installed only after explicit success tokens',
  client,
  /const accepted\s*=\s*data\.ok\s*===\s*true[\s\S]*setSession\(/,
);
contract(
  'AuthContext requires is_admin after PIN login',
  auth,
  /loginWithPin[\s\S]*adminPinLogin\(pin\)[\s\S]*refreshAdmin\(\)/,
);
contract(
  'AuthContext binds the fresh PIN grant to the current user',
  auth,
  /pinVerifiedUserIdRef\.current\s*=\s*freshSession\.user\.id[\s\S]*hasFreshPinVerification/,
);
contract(
  'Edge Function validates the server-side PIN',
  edge,
  /const ADMIN_PIN\s*=\s*Deno\.env\.get\('ADMIN_PIN'\)[\s\S]*pinsMatch\(pin, ADMIN_PIN\)/,
);
contract(
  'Edge Function uses the private admin authority gate',
  edge,
  /adminClient\.rpc\('admin_login_is_active',\s*\{[\s\S]*p_user_id:\s*session\.user\.id[\s\S]*adminCheckError\s*\|\|\s*isAdmin\s*!==\s*true/,
);
assert.doesNotMatch(edge, /\.from\(['"]profiles['"]\)|profile\?\.role\s*!==\s*['"]admin['"]/, 'admin-login must not authorize from profiles.role');
console.log('PASS: Edge Function has no profiles.role authority dependency');
contract(
  'Database authority remains public.is_admin()',
  sql,
  /CREATE OR REPLACE FUNCTION public\.is_admin\(\)[\s\S]*FROM public\.profiles[\s\S]*role = 'admin'/,
);
assert.doesNotMatch(client, /const\s+ADMIN_(?:PIN|EMAIL|PASSWORD)\s*=/, 'Frontend must not define admin secrets');
console.log('PASS: No admin Secret values exposed in frontend source');

console.log('\nAdmin regression suite passed.');
