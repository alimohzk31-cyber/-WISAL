export const APP_ONLINE_EVENT = 'wisal:online';

export const OFFLINE_ACTION_MESSAGE = 'هذه العملية تحتاج اتصالًا بالإنترنت';

export type AppNetworkStatus = 'online' | 'offline' | 'slow' | 'recovering';

interface BrowserNetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
}

export function browserNetworkInformation(): BrowserNetworkInformation | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as Navigator & { connection?: BrowserNetworkInformation }).connection;
}

export function networkQualityStatus(connected = typeof navigator === 'undefined' || navigator.onLine !== false): AppNetworkStatus {
  if (!connected) return 'offline';
  const connection = browserNetworkInformation();
  const effectiveType = connection?.effectiveType?.toLowerCase();
  if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'slow';
  if (typeof connection?.downlink === 'number' && connection.downlink > 0 && connection.downlink < 0.75) return 'slow';
  if (typeof connection?.rtt === 'number' && connection.rtt >= 800) return 'slow';
  return 'online';
}

export function isOnlineConnection(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/** Prevent ambiguous POST/upload attempts while keeping the caller's form state intact. */
export function requireOnlineConnection(): void {
  if (!isOnlineConnection()) throw new Error(OFFLINE_ACTION_MESSAGE);
}

export function notifyAppOnline() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(APP_ONLINE_EVENT));
}
