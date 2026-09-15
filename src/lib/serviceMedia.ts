import { offlineStore, OFFLINE_KEYS } from './offlineStore';
import { supabase } from './supabase';
import { resolveSlideImageSrc } from './slideImageSource';

type MediaEntry = { image: string; savedAt: number };
type MediaCache = Record<string, MediaEntry>;

const MAX_MEDIA_ENTRIES = 80;
let memoryCache: MediaCache | null = null;
let loadRequest: Promise<MediaCache> | null = null;
const imageRequests = new Map<string, Promise<string>>();
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

export async function fetchServiceImage(id: string | number): Promise<string> {
  const key = String(id);
  const cached = await getCachedServiceImage(key);
  if (typeof navigator !== 'undefined' && !navigator.onLine) return cached;
  const pending = imageRequests.get(key);
  if (pending) return pending;

  const request = (async () => {
    const { data, error } = await supabase.from('services')
      .select('image_url').eq('id', id).eq('status', 'approved').maybeSingle();
    if (error) throw error;
    // Store the browser-ready URL, not a raw relative Storage path. This keeps
    // both the slider and offline consumers from retrying an invalid relative
    // URL after the service row has been cached.
    const image = typeof data?.image_url === 'string' ? resolveSlideImageSrc(data.image_url) : '';
    if (image) {
      const cache = await loadCache();
      cache[key] = { image, savedAt: Date.now() };
      persistCache();
    }
    return image || cached;
  })().catch(error => {
    console.warn('[ServiceMedia] Image refresh failed:', error);
    return cached;
  }).finally(() => imageRequests.delete(key));
  imageRequests.set(key, request);
  return request;
}
