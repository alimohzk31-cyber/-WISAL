import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SOCIAL_PLATFORMS, invalidSocialContact, socialContactUrl, type SocialPlatform } from '../src/lib/serviceSocialLinks';

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

test('WhatsApp normalizes a leading 00 international prefix', () => {
  assert.equal(socialContactUrl('whatsapp', '00964 770 123 4567'), 'https://wa.me/9647701234567');
});

// نفس منطق بناء الروابط داخل ServiceSocialLinks (نفس الاستدعاءات تمامًا) —
// يغطي الحالات الثلاث: أربع منصات، منصة واحدة، وبلا حسابات.
function buildLinks(values: Partial<Record<SocialPlatform, string>>): SocialPlatform[] {
  return SOCIAL_PLATFORMS.flatMap(platform => {
    const href = socialContactUrl(platform, values[platform]);
    return href ? [platform] : [];
  });
}

test('A service with all four platforms renders exactly four validated links', () => {
  const links = buildLinks({
    whatsapp: '+964 770 123 4567',
    facebook: 'https://facebook.com/wisal',
    instagram: 'instagram.com/wisal',
    tiktok: 'https://www.tiktok.com/@wisal',
  });
  assert.deepEqual(links, ['whatsapp', 'facebook', 'instagram', 'tiktok']);
});

test('A service with one platform renders only that platform icon', () => {
  assert.deepEqual(buildLinks({ whatsapp: '00964 770 123 4567', facebook: 'https://example.com' }), ['whatsapp']);
});

test('A service with no accounts renders nothing at all', () => {
  assert.deepEqual(buildLinks({ whatsapp: '', facebook: '', instagram: '', tiktok: '' }), []);
});
