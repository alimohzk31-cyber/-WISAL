export function registerAppServiceWorker() {
  if (!(import.meta as any).env.PROD || !('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(window.location.protocol)) return;

  const workerUrl = new URL('sw.js', document.baseURI);
  const register = () => {
    void navigator.serviceWorker.register(workerUrl, { scope: './', updateViaCache: 'none' })
      .then(registration => registration.update())
      .catch(error => console.warn('[ServiceWorker] Registration failed:', error));
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
