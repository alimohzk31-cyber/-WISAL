import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSliderLinksPayload, sanitizeSliderLink, SLIDER_LINK_FIELDS } from '../src/lib/sliderLinks';
import { buildDesignPayload } from '../src/hooks/useSlider';

test('six link fields persist separately from unsupported optional design fields', () => {
  const input = { button_text: ' Visit ', button_link: '/services', facebook_url: 'https://facebook.com/wisal', instagram_url: 'https://instagram.com/wisal', tiktok_url: 'https://tiktok.com/@wisal', twitter_url: 'https://x.com/wisal', subtitle: 'optional design' };
  const payload = buildSliderLinksPayload(input);
  assert.equal(Object.keys(payload).length, 6);
  assert.equal(payload.button_text, 'Visit');
  assert.equal(payload.button_link, '/services');
  for (const field of SLIDER_LINK_FIELDS) assert.ok(payload[field]);
  const design = buildDesignPayload(input);
  for (const field of SLIDER_LINK_FIELDS) assert.equal(design[field as keyof typeof design], undefined);
});

test('links support internal routes and HTTP(S), while unsafe schemes are rejected', () => {
  assert.equal(sanitizeSliderLink('/?view=services'), '/?view=services');
  assert.equal(sanitizeSliderLink('example.com/path'), 'https://example.com/path');
  for (const link of ['javascript:alert(1)', 'data:text/html,evil', '//evil.test', '/\\evil.test', 'file:///tmp', 'https://user:password@example.com']) {
    assert.equal(sanitizeSliderLink(link), undefined);
  }
  assert.deepEqual(buildSliderLinksPayload({ button_text: '', button_link: 'javascript:alert(1)', facebook_url: '', tiktok_url: 'data:text/html,evil' }), {
    button_text: null, button_link: null, facebook_url: null, tiktok_url: null,
  });
  assert.deepEqual(buildSliderLinksPayload({}), {});
});
