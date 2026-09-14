import localforage from 'localforage';

// Configure localforage
localforage.config({
  name: 'SaleenService',
  storeName: 'offline_data',
  description: 'وصال: آخر محتوى صالح للاستخدام دون اتصال'
});

// IndexedDB is the primary durable store on Web and Capacitor WebView.  The
// localStorage fallback keeps the app usable in restricted/private browsers.
void localforage.setDriver([
  localforage.INDEXEDDB,
  localforage.LOCALSTORAGE,
]).catch(error => console.warn('[OfflineStore] No persistent driver available:', error));

export const OFFLINE_KEYS = {
  SERVICES: 'cached_services',
  SERVICE_MEDIA: 'cached_service_media',
  CATEGORIES: 'cached_categories',
  SLIDER: 'cached_slider',
  JOBS: 'cached_jobs',
  JOB_PRESENTATION: 'cached_job_presentation',
  PENDING_SERVICES: 'pending_services',
  PENDING_CATEGORIES: 'pending_categories'
};

const CACHE_META_SUFFIX = ':meta';

export interface OfflineCacheMetadata {
  updatedAt: number;
}

export const offlineStore = {
  async setItem<T>(key: string, value: T): Promise<T> {
    const saved = await localforage.setItem(key, value);
    await localforage.setItem<OfflineCacheMetadata>(`${key}${CACHE_META_SUFFIX}`, { updatedAt: Date.now() });
    return saved;
  },

  async getItem<T>(key: string): Promise<T | null> {
    return await localforage.getItem<T>(key);
  },

  async removeItem(key: string): Promise<void> {
    await Promise.all([
      localforage.removeItem(key),
      localforage.removeItem(`${key}${CACHE_META_SUFFIX}`),
    ]);
  },

  async getUpdatedAt(key: string): Promise<number | null> {
    const metadata = await localforage.getItem<OfflineCacheMetadata>(`${key}${CACHE_META_SUFFIX}`);
    return typeof metadata?.updatedAt === 'number' ? metadata.updatedAt : null;
  },

  async clear(): Promise<void> {
    await localforage.clear();
  }
};
