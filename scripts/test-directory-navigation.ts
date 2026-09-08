import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryRouter } from 'react-router-dom';
import { categoryUrl, directoryBackAction, directoryEntryState, getHomeView, readCategoryUrl } from '../src/lib/directoryNavigation';

const makeRouter = (entry: string) => createMemoryRouter([{ path: '*' }], { initialEntries: [entry] });

test('services → main → child → main → services follows real history, including Forward', async () => {
  const router = makeRouter('/?view=services&q=سيارات');
  await router.navigate(categoryUrl('cars'), { state: directoryEntryState(router.state.location) });
  await router.navigate(categoryUrl('cars', 'car-repair'), { state: directoryEntryState(router.state.location) });
  const action = directoryBackAction({ state: router.state.location.state, parentUrl: categoryUrl('cars'), isChild: true, previousIsParent: true, hasHistory: true });
  assert.deepEqual(action, { delta: -1 });
  await router.navigate(-1);
  assert.equal(router.state.location.pathname, categoryUrl('cars'));
  assert.equal(router.state.location.search, '');
  await router.navigate(-1);
  assert.equal(getHomeView(router.state.location.search), 'services');
  assert.equal(new URLSearchParams(router.state.location.search).get('q'), 'سيارات');
  await router.navigate(1);
  assert.equal(router.state.location.pathname, categoryUrl('cars'));
  router.dispose();
});

test('a real browse source remains browse after returning', async () => {
  const router = makeRouter('/?view=browse');
  await router.navigate(categoryUrl('doctors'), { state: directoryEntryState(router.state.location) });
  assert.equal(router.state.location.state.directoryOrigin, '/?view=browse');
  const action = directoryBackAction({ state: router.state.location.state, parentUrl: categoryUrl('doctors'), isChild: false, previousIsParent: false, hasHistory: true });
  assert.deepEqual(action, { delta: -1 });
  await router.navigate(-1);
  assert.equal(getHomeView(router.state.location.search), 'browse');
  router.dispose();
});

test('direct specialty search inserts a parent on Back without returning to the child in a loop', async () => {
  const router = makeRouter('/?view=services&q=أسنان');
  await router.navigate(categoryUrl('doctors', 'dentist'), { state: directoryEntryState(router.state.location) });
  const action = directoryBackAction({ state: router.state.location.state, parentUrl: categoryUrl('doctors'), isChild: true, previousIsParent: false, hasHistory: true });
  assert.ok('to' in action);
  await router.navigate(action.to, { replace: action.replace, state: action.state });
  assert.equal(router.state.location.pathname, categoryUrl('doctors'));
  await router.navigate(-1);
  assert.equal(getHomeView(router.state.location.search), 'services');
  router.dispose();
});

test('switching sibling specialties preserves the parent as the previous history entry', async () => {
  const router = makeRouter('/?view=services');
  await router.navigate(categoryUrl('education'), { state: directoryEntryState(router.state.location) });
  await router.navigate(categoryUrl('education', 'school'), { state: directoryEntryState(router.state.location) });
  await router.navigate(categoryUrl('education', 'tutor'), { replace: true, state: router.state.location.state });
  await router.navigate(-1);
  assert.equal(router.state.location.pathname, categoryUrl('education'));
  assert.equal(router.state.location.search, '');
  router.dispose();
});

test('external entries have safe fallbacks and URL state preserves the existing two home views', () => {
  assert.equal(getHomeView(''), 'browse');
  assert.equal(getHomeView('?tool=search'), 'services');
  const action = directoryBackAction({ state: null, parentUrl: categoryUrl('cars'), isChild: false, previousIsParent: false, hasHistory: false });
  assert.ok('to' in action);
  assert.equal(action.to, '/?view=services');
  const unsafe = directoryBackAction({ state: { directoryOrigin: '/admin', directoryPrevious: 'https://other.test' }, parentUrl: categoryUrl('cars'), isChild: false, previousIsParent: false, hasHistory: true });
  assert.ok('to' in unsafe);
  assert.equal(unsafe.to, '/?view=services');
  assert.deepEqual(readCategoryUrl(categoryUrl('cars', 'oil-change')), { slug: 'cars', childSlug: 'oil-change' });
});
