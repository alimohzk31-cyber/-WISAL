import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { BROWSE_DESCRIPTION_PREVIEW_LENGTH, getBrowseDescriptionPreview } from '../src/lib/browseServiceCard';

test('short browse descriptions remain unchanged', () => {
  assert.deepEqual(getBrowseDescriptionPreview('  وصف مختصر للخدمة  '), { text: 'وصف مختصر للخدمة', truncated: false });
});

test('long browse descriptions are shortened without changing the source', () => {
  const full = 'تفاصيل الخدمة '.repeat(20).trim();
  const preview = getBrowseDescriptionPreview(full);
  assert.equal(preview.truncated, true);
  assert.ok(preview.text.endsWith('…'));
  assert.ok(preview.text.length <= BROWSE_DESCRIPTION_PREVIEW_LENGTH + 1);
  assert.ok(full.length > preview.text.length);
});

test('browse card keeps inline expansion separate from category navigation', async () => {
  const source = await readFile(new URL('../src/components/SocialFeed.tsx', import.meta.url), 'utf8');
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /\{expanded \? 'عرض أقل' : 'المزيد'\}/);
  assert.match(source, /images=\{\[browseImages\[0\]\]\}/);
  assert.match(source, /alt=\{service\.name\} compact/);
  assert.match(source, /openServiceCategory\(navigate, location, service, placement\)/);
  assert.match(source, /الدخول إلى القسم/);
  assert.doesNotMatch(source, /معاينة الخدمة/);
  assert.doesNotMatch(source, /openServiceDetails/);
});
