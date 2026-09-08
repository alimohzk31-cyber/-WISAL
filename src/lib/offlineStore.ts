import localforage from 'localforage';
import { withTimeout } from './withTimeout';

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
    try { return await withTimeout(localforage.getItem<T>(key), 3000); }
    catch (error) {
      console.warn('تعذرت قراءة النسخة المحلية:', error);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    await localforage.removeItem(key);
  },

  async clear(): Promise<void> {
    await localforage.clear();
  }
};
