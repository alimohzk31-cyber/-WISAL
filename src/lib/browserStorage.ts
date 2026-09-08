// Storage may be disabled by the browser. Preferences must not prevent rendering.
export const browserStorage = {
  get(key: string, session = false): string | null {
    try { return (session ? window.sessionStorage : window.localStorage).getItem(key); }
    catch { return null; }
  },
  set(key: string, value: string, session = false) {
    try { (session ? window.sessionStorage : window.localStorage).setItem(key, value); }
    catch { /* Keep the current UI usable without persistence. */ }
  },
  remove(key: string, session = false) {
    try { (session ? window.sessionStorage : window.localStorage).removeItem(key); }
    catch { /* Storage is optional. */ }
  },
};
