import { offlineStore, OFFLINE_KEYS } from './offlineStore';
import { supabase } from './supabase';
import { resolveSlideImageSrc } from './slideImageSource';

type MediaEntry = { image: string; savedAt: number };
type MediaCache = Record<string, MediaEntry>;

const MAX_MEDIA_ENTRIES = 80;
const SERVICE_IMAGE_CACHE_TTL = 6 * 60 * 60 * 1000;
const FAILED_IMAGE_RETRY_DELAY = 30 * 1000;
let memoryCache: MediaCache | null = null;
let loadRequest: Promise<MediaCache> | null = null;
const imageRequests = new Map<string, Promise<string>>();
const failedImageRequests = new Map<string, number>();
let writeQueue: Promise<unknown> = Promise.resolve();

async function loadCache(): Promise<MediaCache> {
  if (memoryCache) return memoryCache;
  if (!loadRequest) {
    loadRequest = offlineStore.getItem<MediaCache>(OFFLINE_KEYS.SERVICE_MEDIA)
      .then(value => (memoryCache = value || {}))
      .catch(() => (memoryCache = {}))
      .finally(() => { loadRequest = null; });
  }
  return loadRequest;
}

function persistCache() {
  writeQueue = writeQueue.then(async () => {
    if (!memoryCache) return;
    const trimmed = Object.fromEntries(Object.entries(memoryCache)
      .sort((a, b) => b[1].savedAt - a[1].savedAt)
      .slice(0, MAX_MEDIA_ENTRIES));
    memoryCache = trimmed;
    await offlineStore.setItem(OFFLINE_KEYS.SERVICE_MEDIA, trimmed);
  }).catch(error => console.warn('[ServiceMedia] Cache write failed:', error));
}

export async function getCachedServiceImage(id: string | number): Promise<string> {
  const cached = (await loadCache())[String(id)]?.image || '';
  return cached ? resolveSlideImageSrc(cached) : '';
}

function requestServiceImage(id: string | number, key: string, cached: string): Promise<string> {
  const existing = imageRequests.get(key);
  if (existing) return existing;
  const request = (async () => {
    const { data, error } = await supabase.from('services')
      .select('image_url').eq('id', id).eq('status', 'approved').maybeSingle();
    if (error) throw error;
    // Store the browser-ready URL, not a raw relative Storage path. This keeps
    // both the slider and offline consumers from retrying an invalid relative
    // URL after the service row has been cached.
    const image = typeof data?.image_url === 'string' ? resolveSlideImageSrc(data.image_url) : '';
    const cache = await loadCache();
    cache[key] = { image, savedAt: Date.now() };
    failedImageRequests.delete(key);
    persistCache();
    return image || cached;
  })().catch(error => {
    failedImageRequests.set(key, Date.now());
    console.warn('[ServiceMedia] Image refresh failed:', error);
    return cached;
  }).finally(() => imageRequests.delete(key));
  imageRequests.set(key, request);
  return request;
}

/**
 * Return a cached image without waiting for the network. Fresh cache entries
 * never issue another query; stale entries are shown immediately and refreshed
 * once in the background. Concurrent first loads for one service share a query.
 */
export async function fetchServiceImage(id: string | number): Promise<string> {
  const key = String(id);
  const cache = await loadCache();
  const entry = cache[key];
  const cached = entry?.image ? resolveSlideImageSrc(entry.image) : '';
  const age = entry ? Date.now() - entry.savedAt : Number.POSITIVE_INFINITY;

  if (entry && age >= 0 && age < SERVICE_IMAGE_CACHE_TTL) return cached;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return cached;
  const lastFailure = failedImageRequests.get(key);
  if (lastFailure !== undefined && Date.now() - lastFailure < FAILED_IMAGE_RETRY_DELAY) return cached;

  if (cached || entry) {
    // Keep stale and negative-cache results visible while refreshing off-thread.
    void requestServiceImage(id, key, cached);
    return cached;
  }

  return requestServiceImage(id, key, cached);
}
