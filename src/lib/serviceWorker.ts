const DEV_SW_CLEANUP_KEY = 'wisal-dev-sw-cleanup-v1';

function isLocalhost() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

async function clearLocalDevelopmentWorker() {
  if (!isLocalhost() || sessionStorage.getItem(DEV_SW_CLEANUP_KEY) === '1') return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  const cacheNames = await caches.keys();
  const appCacheNames = cacheNames.filter(name => name.startsWith('wisal-'));
  if (registrations.length === 0 && appCacheNames.length === 0) return;

  sessionStorage.setItem(DEV_SW_CLEANUP_KEY, '1');
  await Promise.all([
    ...registrations.map(registration => registration.unregister()),
    ...appCacheNames.map(name => caches.delete(name)),
  ]);
  window.location.reload();
}

export function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(window.location.protocol)) return;

  if (!(import.meta as any).env.PROD) {
    void clearLocalDevelopmentWorker().catch(error => console.warn('[ServiceWorker] Development cleanup failed:', error));
    return;
  }

  const workerUrl = new URL('sw.js', document.baseURI);
  const register = () => {
    void navigator.serviceWorker.register(workerUrl, { scope: './', updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(error => console.warn('[ServiceWorker] Registration failed:', error));
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
