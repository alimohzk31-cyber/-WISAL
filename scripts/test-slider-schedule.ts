import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdStatus } from '../src/hooks/useSlider';

test('editor midnight defaults show the slide throughout its selected day', () => {
  const ad = { is_active: true, display_date: '2026-10-01', start_hour: 0, start_minute: 0, start_second: 0, end_hour: 0, end_minute: 0, end_second: 0 };
  assert.equal(getAdStatus(ad, new Date(2026, 9, 1, 14, 30)), 'active');
  assert.equal(getAdStatus(ad, new Date(2026, 9, 1, 23, 59, 59)), 'active');
  assert.equal(getAdStatus(ad, new Date(2026, 9, 2)), 'expired');
  assert.equal(getAdStatus(ad, new Date(2026, 8, 30, 23, 59)), 'upcoming');
  assert.equal(getAdStatus({ ...ad, is_active: false }, new Date(2026, 9, 1, 14)), 'disabled');
});

test('explicit time windows and undated legacy slides retain their visibility rules', () => {
  const ad = { display_date: '2026-10-01', start_hour: 10, end_hour: 12 };
  assert.equal(getAdStatus(ad, new Date(2026, 9, 1, 9)), 'upcoming');
  assert.equal(getAdStatus(ad, new Date(2026, 9, 1, 11)), 'active');
  assert.equal(getAdStatus(ad, new Date(2026, 9, 1, 13)), 'expired');
  assert.equal(getAdStatus({ display_date: '', is_active: true }, new Date(2027, 1, 1)), 'active');
});
