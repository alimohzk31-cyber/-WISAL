import type { Service } from '../types/models';

export type SocialPlatform = 'whatsapp' | 'facebook' | 'instagram' | 'tiktok';

export const SOCIAL_PLATFORMS: SocialPlatform[] = ['whatsapp', 'facebook', 'instagram', 'tiktok'];

const allowedHosts: Record<Exclude<SocialPlatform, 'whatsapp'>, string[]> = {
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'www.fb.com'],
  instagram: ['instagram.com', 'www.instagram.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'],
};

export function socialContactUrl(platform: SocialPlatform, value?: string): string | undefined {
  const input = value?.trim();
  if (!input) return undefined;
  if (platform === 'whatsapp') {
    const digits = input.replace(/[^0-9]/g, '').replace(/^00/, '');
    return digits.length >= 7 && digits.length <= 15 ? `https://wa.me/${digits}` : undefined;
  }
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    const host = url.hostname.toLowerCase();
    return allowedHosts[platform].includes(host) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function invalidSocialContact(service: Pick<Service, 'whatsappPhone' | 'facebookUrl' | 'instagramUrl' | 'tiktokUrl'>): SocialPlatform | undefined {
  const values = {
    whatsapp: service.whatsappPhone,
    facebook: service.facebookUrl,
    instagram: service.instagramUrl,
    tiktok: service.tiktokUrl,
  };
  return SOCIAL_PLATFORMS.find(platform => values[platform]?.trim() && !socialContactUrl(platform, values[platform]));
}
