import localforage from 'localforage';

// Configure localforage
localforage.config({
  name: 'SaleenService',
  storeName: 'offline_data'
});

export const OFFLINE_KEYS = {
  SERVICES: 'cached_services',
  CATEGORIES: 'cached_categories',
  PENDING_SERVICES: 'pending_services',
  PENDING_CATEGORIES: 'pending_categories'
};

export const offlineStore = {
  async setItem<T>(key: string, value: T): Promise<T> {
    return await localforage.setItem(key, value);
  },

  async getItem<T>(key: string): Promise<T | null> {
    return await localforage.getItem<T>(key);
  },

  async removeItem(key: string): Promise<void> {
    await localforage.removeItem(key);
  },

  async clear(): Promise<void> {
    await localforage.clear();
  }
};
