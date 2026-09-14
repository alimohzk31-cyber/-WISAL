import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invalidSocialContact, socialContactUrl } from '../src/lib/serviceSocialLinks';

test('WhatsApp accepts a valid international phone and strips formatting', () => {
  assert.equal(socialContactUrl('whatsapp', '+964 770 123 4567'), 'https://wa.me/9647701234567');
  assert.equal(socialContactUrl('whatsapp', '12'), undefined);
});

test('Facebook accepts only Facebook hosts', () => {
  assert.equal(socialContactUrl('facebook', 'facebook.com/wisal'), 'https://facebook.com/wisal');
  assert.equal(socialContactUrl('facebook', 'https://example.com/facebook'), undefined);
});

test('Instagram accepts only Instagram hosts', () => {
  assert.equal(socialContactUrl('instagram', 'instagram.com/wisal'), 'https://instagram.com/wisal');
  assert.equal(socialContactUrl('instagram', 'javascript:alert(1)'), undefined);
});

test('TikTok accepts only TikTok hosts and optional empty fields stay valid', () => {
  assert.equal(socialContactUrl('tiktok', 'https://www.tiktok.com/@wisal'), 'https://www.tiktok.com/@wisal');
  assert.equal(invalidSocialContact({ whatsappPhone: '', facebookUrl: '', instagramUrl: '', tiktokUrl: '' }), undefined);
});
