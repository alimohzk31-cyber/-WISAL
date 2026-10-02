import type { SliderAd } from '../hooks/useSlider';
import { resolveSlideImageSrc } from './slideImageSource';

/** The same record, primary image and deterministic order in both viewers. */
export function getSliderImageSource(ad: Partial<SliderAd>): string {
  return ad.images?.find(image => typeof image === 'string' && image.trim())?.trim()
    || ad.url?.trim() || '';
}

export function compareSliderOrder(a: SliderAd, b: SliderAd): number {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    || (Date.parse(a.created_at || '') || 0) - (Date.parse(b.created_at || '') || 0)
    || a.id - b.id;
}

/** Record revision changes the cache key when a Storage path is reused. */
export function getSliderImageUrl(ad: Partial<SliderAd>): string {
  const source = resolveSlideImageSrc(getSliderImageSource(ad));
  if (!source || /^(?:data:|blob:)/i.test(source)) return source;
  try {
    const url = new URL(source, typeof window === 'undefined' ? 'https://wisal.invalid' : window.location.origin);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    url.searchParams.set('_wisal_slider', String(ad.id ?? 'draft'));
    url.searchParams.set('_wisal_rev', ad.updated_at || ad.created_at || 'original');
    return source.startsWith('/') && !source.startsWith('//') ? url.pathname + url.search + url.hash : url.href;
  } catch { return ''; }
}
