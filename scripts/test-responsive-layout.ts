import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { directorySections } from '../src/data/categoryDirectory';

const source = (path: string) => readFileSync(path, 'utf8');

test('car directory keeps every large branch set inside the responsive category menu', () => {
  const cars = directorySections.find(section => section.slug === 'cars');
  assert.ok(cars);
  assert.ok(cars.children.length >= 10);
  for (const slug of ['car-mechanic', 'oil-change', 'car-glass']) {
    assert.ok(cars.children.some(child => child.slug === slug), `missing ${slug}`);
  }

  const categoryPage = source('src/pages/CategoryPage.tsx');
  for (const responsiveInvariant of [
    'relative w-full min-w-0 sm:w-auto',
    'absolute inset-x-0 top-full',
    'sm:w-64',
    'min-w-0 break-words',
  ]) {
    assert.ok(categoryPage.includes(responsiveInvariant), responsiveInvariant);
  }
});

test('primary navigation and forms solve overflow without an x-hidden workaround', () => {
  assert.ok(!source('src/components/DirectoryNav.tsx').includes('whitespace-nowrap'));
  for (const path of [
    'src/components/AddServiceModal.tsx',
    'src/components/EditServiceModal.tsx',
    'src/index.css',
  ]) {
    assert.ok(!source(path).includes('overflow-x-hidden'), path);
  }
});

test('shared viewport, media, slider, modal and long-text constraints stay enabled', () => {
  const css = source('src/index.css');
  assert.match(css, /html,[\s\S]*body,[\s\S]*#root[\s\S]*max-width:\s*100%/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /img,[\s\S]*video,[\s\S]*canvas[\s\S]*max-inline-size:\s*100%/);

  assert.ok(source('src/data/slideStyles.ts').includes('w-full min-w-0 max-w-full'));
  assert.ok(source('src/components/ServiceModalShell.tsx').includes('w-full min-w-0 max-w-lg'));
  assert.ok(source('src/components/PostInteractions.tsx').includes('flex min-w-0 flex-wrap'));
});
