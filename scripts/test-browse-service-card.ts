import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  BROWSE_DESCRIPTION_PREVIEW_LENGTH,
  getBrowseDescriptionPreview,
  getBrowseExtraImages,
  getBrowseImages,
  hasBrowseDetails,
} from '../src/lib/browseServiceCard';

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

test('browse card shows the hero image once and counts only the extra images', () => {
  const service = { image: 'hero.jpg', images: ['hero.jpg', 'a.jpg', 'b.jpg', '   '] };
  assert.deepEqual(getBrowseImages(service), ['hero.jpg', 'a.jpg', 'b.jpg']);
  assert.deepEqual(getBrowseExtraImages(service), ['a.jpg', 'b.jpg']);
  assert.deepEqual(getBrowseImages({ image: '', images: [] }), []);
  assert.deepEqual(getBrowseExtraImages({ image: '', images: ['only.jpg'] }), []);
});

test('«المزيد» is offered only when a detail is not already visible in the short card', () => {
  assert.equal(hasBrowseDetails({}), false);
  assert.equal(hasBrowseDetails({ location: '   ' }), false);
  assert.equal(hasBrowseDetails({ image: 'hero.jpg', images: ['hero.jpg'] }), false);
  assert.equal(hasBrowseDetails({ location: 'بغداد - الكرادة' }), true);
  assert.equal(hasBrowseDetails({ subCategory: 'صيدلية' }), true);
  assert.equal(hasBrowseDetails({ phone: '07700000000' }), true);
  assert.equal(hasBrowseDetails({ whatsappPhone: '07700000000' }), true);
  assert.equal(hasBrowseDetails({ facebookUrl: 'https://facebook.com/x' }), true);
  assert.equal(hasBrowseDetails({ instagramUrl: 'https://instagram.com/x' }), true);
  assert.equal(hasBrowseDetails({ tiktokUrl: 'https://tiktok.com/@x' }), true);
  assert.equal(hasBrowseDetails({ video: 'https://youtu.be/x' }), true);
  assert.equal(hasBrowseDetails({ latitude: 33.31, longitude: 44.36 }), true);
  assert.equal(hasBrowseDetails({ image: 'hero.jpg', images: ['hero.jpg', 'two.jpg'] }), true);
});

test('browse card keeps one «المزيد», one «عرض أقل» and a single actions row', async () => {
  const source = await readFile(new URL('../src/components/SocialFeed.tsx', import.meta.url), 'utf8');
  const interactions = await readFile(new URL('../src/components/PostInteractions.tsx', import.meta.url), 'utf8');
  const occurrences = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;

  // كلمة «المزيد» وكلمة «عرض أقل» مرة واحدة فقط (زر الترقيم «عرض المزيد» ليس منهما)
  assert.equal(occurrences(source, />\s*المزيد\s*</g), 1);
  assert.equal(occurrences(source, />\s*عرض أقل\s*</g), 1);
  assert.match(source, /aria-expanded=\{detailsOpen\}/);
  assert.match(source, /aria-controls=\{`browse-details-\$\{serviceKey\}`\}/);
  assert.match(source, /onOpenCategory=\{\(\) => openServiceCategory\(navigate, location, service, placement\)\}/);

  // لا زر كبير «الدخول إلى القسم» في البطاقة؛ القسم يُفتح من صف التفاعل فقط
  assert.doesNotMatch(source, /الدخول إلى القسم/);
  assert.match(interactions, /aria-label="الدخول إلى القسم"/);
  assert.match(interactions, /<LayoutGrid className="h-4 w-4" \/>\s*<span>القسم<\/span>/);

  // الترتيب: إعجاب ← تعليق ← حفظ ← القسم، وكلها في صف واحد بلا التفاف
  const saveIndex = interactions.indexOf('onToggleSaved');
  const commentIndex = interactions.indexOf('aria-label="التعليقات"');
  const likeIndex = interactions.indexOf('handleLikeClick');
  const categoryIndex = interactions.indexOf('aria-label="الدخول إلى القسم"');
  assert.ok(likeIndex > -1 && commentIndex > likeIndex && saveIndex > commentIndex && categoryIndex > saveIndex,
    'ترتيب الصف هو إعجاب ثم تعليق ثم حفظ ثم القسم');
  assert.doesNotMatch(interactions, /flex-wrap/);
  assert.doesNotMatch(source, /معاينة الخدمة|openServiceDetails/);
});
