import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sqlPath = new URL('../supabase_admin_security_hardening.sql', import.meta.url);
const legacyRpcPath = new URL('../supabase_admin_rpc.sql', import.meta.url);
const legacyRlsPath = new URL('../supabase_security_phase1_final.sql', import.meta.url);

test('hardening SQL is non-destructive and transaction-wrapped', async () => {
  const sql = await readFile(sqlPath, 'utf8');
  assert.match(sql, /\bBEGIN\s*;/i);
  assert.match(sql, /\bCOMMIT\s*;/i);
  assert.doesNotMatch(sql, /\bDROP\s+(?:TABLE|SCHEMA)\b/i);
  assert.doesNotMatch(sql, /\bTRUNCATE\b/i);
});

test('admin RPCs and exclusive reads require a verified admin', async () => {
  const sql = await readFile(sqlPath, 'utf8');
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.is_admin\(\)/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.require_admin\(\)/i);
  assert.ok((sql.match(/admin authorization required/g) ?? []).length >= 5);
  assert.match(sql, /ALTER FUNCTION %s SECURITY INVOKER/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon/i);
  assert.match(sql, /AS RESTRICTIVE FOR SELECT TO anon, authenticated/i);
});

test('legacy source files cannot reintroduce authenticated-equals-admin', async () => {
  const [rpcSql, rlsSql] = await Promise.all([
    readFile(legacyRpcPath, 'utf8'),
    readFile(legacyRlsPath, 'utf8'),
  ]);
  assert.doesNotMatch(rpcSql, /SECURITY DEFINER/i);
  assert.doesNotMatch(rpcSql, /GRANT EXECUTE[^;]+TO\s+anon/i);
  assert.doesNotMatch(rlsSql, /auth\.role\(\)\s*=\s*'authenticated'/i);
});
