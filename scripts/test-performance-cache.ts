import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequestCache } from '../src/lib/requestCache';
import { mergeServiceSnapshot } from '../src/lib/serviceSnapshot';
import { useCategoryDirectory } from '../src/hooks/useCategoryDirectory';
import { APP_VERSION, PREVIOUS_APP_VERSION } from '../src/lib/appVersion';
import { networkQualityStatus, OFFLINE_ACTION_MESSAGE } from '../src/lib/connectivity';
import { buildCategoryLookup, relinkCachedServiceCategories, resolveServiceCategory } from '../src/lib/serviceCategoryLink';
import type { Service } from '../src/types/models';

test('concurrent mounts share one read, including forced reads; empty data is cached', async () => {
  const cache = createRequestCache<string[]>(60_000);
  let calls = 0;
  const load = async () => { calls++; return []; };
  const reads = Array.from({ length: 8 }, () => cache.get(load, true));
  assert.ok(reads.every(read => read === reads[0]));
  await Promise.all(reads);
  await cache.get(load);
  assert.equal(calls, 1);
  await cache.get(load, true);
  assert.equal(calls, 2);
});

test('expired reads refresh; failed refresh preserves data and can retry', async () => {
  const cache = createRequestCache<string[]>(0);
  await cache.get(async () => ['old']);
  await assert.rejects(cache.get(async () => { throw new Error('offline'); }));
  assert.deepEqual(cache.peek(), ['old']);
  assert.deepEqual(await cache.get(async () => ['new']), ['new']);
});

test('a late read cannot overwrite a successful mutation', async () => {
  const cache = createRequestCache<string[]>(60_000);
  let finish!: (rows: string[]) => void;
  const reading = cache.get(() => new Promise(resolve => { finish = resolve; }));
  await Promise.resolve();
  cache.set(['saved']);
  finish(['stale']);
  assert.deepEqual(await reading, ['saved']);
  assert.deepEqual(cache.peek(), ['saved']);
});

test('invalidation fetches fresh rows', async () => {
  const cache = createRequestCache<number>(60_000);
  cache.set(1);
  cache.invalidate();
  assert.equal(await cache.get(async () => 2), 2);
});

const service = (id: number, status: Service['status'] = 'approved'): Service => ({
  id, slug: `service-${id}`, name: `Service ${id}`, categorySlug: 'pharmacy', image: '', location: '', createdAt: id, status,
});

test('partial pages retain existing services; completed snapshots remove deleted rows', () => {
  const previous = [service(1), service(2), service(3)];
  const partial = mergeServiceSnapshot(previous, [{ ...service(1), name: 'updated' }]);
  assert.equal(partial.length, 3);
  assert.equal(partial[0].name, 'updated');
  assert.deepEqual(mergeServiceSnapshot(partial, [service(1), service(2)], true).map(row => row.id), [1, 2]);
});

test('metadata refresh preserves cached media omitted from list queries', () => {
  const cached = { ...service(1), image: 'data:image/webp;base64,cached', video: 'cached-video' };
  const refreshed = { ...service(1), name: 'Fresh metadata', image: '' };
  const [result] = mergeServiceSnapshot([cached], [refreshed], true);
  assert.equal(result.name, 'Fresh metadata');
  assert.equal(result.image, cached.image);
  assert.equal(result.video, cached.video);
});

test('approval supersedes the locally cached pending row without duplicates', () => {
  const pending = service(1, 'pending');
  const approved = { ...service(1), id: 8 };
  const result = mergeServiceSnapshot([pending], [pending, approved, pending], true);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, 'approved');
  assert.equal(result[0].id, 8);
});

test('directory memo survives interleaved public and admin consumers', () => {
  const categories: any[] = [];
  const publicRows = [service(1)];
  const adminRows = [service(2)];
  const first = useCategoryDirectory(categories, publicRows);
  useCategoryDirectory(categories, adminRows);
  assert.equal(useCategoryDirectory(categories, publicRows), first);
  assert.notEqual(useCategoryDirectory(categories, [...publicRows]), first);
});

test('confirmed rejection replaces the local pending copy', () => {
  const result = mergeServiceSnapshot([], [service(1, 'pending'), service(1, 'rejected')], true);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, 'rejected');
});

test('release numbering follows 1.1 with 1.2', () => {
  assert.equal(APP_VERSION, '1.2');
  assert.equal(PREVIOUS_APP_VERSION, '1.1');
});

test('central connectivity model exposes offline fallback and the user-facing write guard message', () => {
  assert.equal(networkQualityStatus(false), 'offline');
  assert.equal(OFFLINE_ACTION_MESSAGE, 'هذه العملية تحتاج اتصالًا بالإنترنت');
});

test('category_id canonically links a service even when category_slug is missing or stale', () => {
  const lookup = buildCategoryLookup([
    { id: 11, slug: 'pharmacy' },
    { id: 22, slug: 'carpentry' },
  ]);
  assert.deepEqual(resolveServiceCategory({ category_id: 11, category_slug: '' }, lookup), {
    categoryId: '11', categorySlug: 'pharmacy', subCategory: undefined,
  });
  assert.deepEqual(resolveServiceCategory({ category_id: 22, category_slug: 'pharmacy' }, lookup), {
    categoryId: '22', categorySlug: 'carpentry', subCategory: undefined,
  });
});

test('online pages survive an interrupted refresh and reopen in multiple offline sections', () => {
  const onlineCategories = [
    { id: 11, slug: 'pharmacy', name: 'Pharmacy' },
    { id: 22, slug: 'carpenter', name: 'Carpentry' },
    { id: 33, slug: 'car-wash', name: 'Car wash' },
  ];
  const onlineLookup = buildCategoryLookup(onlineCategories);
  const fromRow = (id: number, categoryId: number, storedSlug = ''): Service => ({
    ...service(id),
    ...resolveServiceCategory({ category_id: categoryId, category_slug: storedSlug }, onlineLookup),
  });

  // Equivalent to successful paginated Online reads: every page is merged
  // without dropping services fetched by earlier pages.
  let durableCache: Service[] = [];
  durableCache = mergeServiceSnapshot(durableCache, [fromRow(1, 11), fromRow(2, 22)], false);
  durableCache = mergeServiceSnapshot(durableCache, [fromRow(3, 33, 'wrong-old-slug')], false);
  const beforeFailure = structuredClone(durableCache);

  // A later network failure never applies an empty complete snapshot.
  durableCache = mergeServiceSnapshot(durableCache, [], false);
  assert.deepEqual(durableCache, beforeFailure);

  // Equivalent to a new Offline app start: category rows and services are read
  // only from durable cache, including repair of a legacy row with a blank slug.
  const offlineLookup = buildCategoryLookup(onlineCategories.map(row => ({ dbId: row.id, slug: row.slug })));
  const legacyCache = durableCache.map(row => row.id === 2 ? { ...row, categorySlug: '' } : row);
  const offlineServices = relinkCachedServiceCategories(legacyCache, offlineLookup);
  const directory = useCategoryDirectory(onlineCategories.map(row => ({
    slug: row.slug, name: row.name, dbId: row.id,
  })), offlineServices);

  assert.deepEqual(directory.bySection.get('pharmacies')?.map(row => row.id), [1]);
  assert.deepEqual(directory.bySection.get('home-services')?.map(row => row.id), [2]);
  assert.deepEqual(directory.bySection.get('cars')?.map(row => row.id), [3]);
  assert.equal(offlineServices.length, beforeFailure.length);
});

test('a completed reconnect refresh replaces stale approved rows with the latest snapshot', () => {
  const oldCache = [service(1), service(2), service(3)];
  const latest = [{ ...service(1), name: 'Fresh service' }, service(4)];
  const refreshed = mergeServiceSnapshot(oldCache, latest, true);
  assert.deepEqual(refreshed.map(row => row.id), [1, 4]);
  assert.equal(refreshed[0].name, 'Fresh service');
});
