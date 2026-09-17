import assert from 'node:assert/strict';
import test from 'node:test';
import { pinsMatch } from '../supabase/functions/admin-login/pin-security';

// Synthetic values only. The real PIN is never imported, read, or printed.
const expected = 'synthetic-admin-pin';

test('accepts only the exact value', () => {
  assert.equal(pinsMatch(expected, expected), true);
});

test('rejects wrong and random values', () => {
  assert.equal(pinsMatch('synthetic-admin-pio', expected), false);
  assert.equal(pinsMatch('random-value-00000', expected), false);
});

test('rejects missing, short, long, and whitespace-padded values', () => {
  assert.equal(pinsMatch('', expected), false);
  assert.equal(pinsMatch(expected.slice(0, -1), expected), false);
  assert.equal(pinsMatch(`${expected}0`, expected), false);
  assert.equal(pinsMatch(` ${expected}`, expected), false);
  assert.equal(pinsMatch(`${expected} `, expected), false);
});
