import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatServiceRelativeTime, getServicePublicationTimestamp } from '../src/lib/servicePublicationTime';

test('approved services use approval/review time instead of request creation time', () => {
  const now = Date.parse('2026-09-11T12:00:20Z');
  const service = {
    status: 'approved' as const,
    createdAt: Date.parse('2026-09-01T08:00:00Z'),
    reviewedAt: Date.parse('2026-09-11T12:00:00Z'),
  };
  assert.equal(getServicePublicationTimestamp(service), service.reviewedAt);
  assert.equal(formatServiceRelativeTime(getServicePublicationTimestamp(service), now), 'الآن');
});

test('legacy approved rows and pending requests safely fall back to createdAt', () => {
  const createdAt = Date.parse('2026-09-11T11:55:00Z');
  assert.equal(getServicePublicationTimestamp({ status: 'approved', createdAt }), createdAt);
  assert.equal(getServicePublicationTimestamp({ status: 'pending', createdAt, reviewedAt: Date.now() }), createdAt);
});

test('relative labels progress through minutes, hour and yesterday', () => {
  const now = Date.parse('2026-09-11T12:00:00Z');
  assert.equal(formatServiceRelativeTime(now - 60_000, now), 'منذ دقيقة');
  assert.equal(formatServiceRelativeTime(now - 5 * 60_000, now), 'منذ 5 دقائق');
  assert.equal(formatServiceRelativeTime(now - 60 * 60_000, now), 'منذ ساعة');
  assert.equal(formatServiceRelativeTime(now - 25 * 60 * 60_000, now), 'أمس');
});

test('UTC and Iraq offsets represent the same publication instant', () => {
  assert.equal(
    Date.parse('2026-09-11T12:00:00Z'),
    Date.parse('2026-09-11T15:00:00+03:00'),
  );
});
