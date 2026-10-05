import { sanitizeExternalUrl } from './externalUrl';

export const SLIDER_SOCIAL_FIELDS = [
  { field: 'facebook_url', label: 'Facebook' },
  { field: 'instagram_url', label: 'Instagram' },
  { field: 'tiktok_url', label: 'TikTok' },
  { field: 'twitter_url', label: 'X / Twitter' },
] as const;
export const SOCIAL_ICON_POSITIONS = ['left', 'right', 'top', 'bottom'] as const;
export type SocialIconsPosition = (typeof SOCIAL_ICON_POSITIONS)[number];
export function normalizeSocialIconsPosition(value: unknown): SocialIconsPosition {
  return SOCIAL_ICON_POSITIONS.includes(value as SocialIconsPosition) ? value as SocialIconsPosition : 'left';
}
export const SLIDER_LINK_FIELDS = ['button_text', 'button_link', ...SLIDER_SOCIAL_FIELDS.map(item => item.field), 'social_icons_position'] as const;
export type SliderLinks = Partial<Record<Exclude<(typeof SLIDER_LINK_FIELDS)[number], 'social_icons_position'>, string | null>> & {
  social_icons_position?: SocialIconsPosition | null;
};

/** Slider buttons also support the existing internal route links. */
export function sanitizeSliderLink(value?: string | null): string | undefined {
  const input = value?.trim();
  if (!input || /[\u0000-\u0020\\]/.test(input)) return undefined;
  if (input.startsWith('/')) return input.startsWith('//') ? undefined : input;
  return sanitizeExternalUrl(input);
}

/** Empty/unsafe links are explicitly cleared; they never fall back to local design storage. */
export function buildSliderLinksPayload(links: SliderLinks): SliderLinks {
  const payload: SliderLinks = {};
  if (links.button_text !== undefined) payload.button_text = links.button_text?.trim() || null;
  if (links.button_link !== undefined) payload.button_link = sanitizeSliderLink(links.button_link) || null;
  for (const { field } of SLIDER_SOCIAL_FIELDS) {
    if (links[field] !== undefined) payload[field] = sanitizeExternalUrl(links[field]) || null;
  }
  if (links.social_icons_position !== undefined) payload.social_icons_position = normalizeSocialIconsPosition(links.social_icons_position);
  return payload;
}
