/** Share reads across StrictMode mounts; failures never become fresh data. */
export function createRequestCache<T>(ttl: number) {
  let value: T | undefined;
  let updatedAt = 0;
  let revision = 0;
  let pending: Promise<T> | undefined;
  return {
    peek: () => value,
    invalidate() { updatedAt = 0; revision++; pending = undefined; },
    set(next: T) { revision++; pending = undefined; value = next; updatedAt = Date.now(); },
    get(load: () => Promise<T>, force = false): Promise<T> {
      if (pending) return pending;
      if (!force && value !== undefined && Date.now() - updatedAt < ttl) return Promise.resolve(value);
      const startedAt = revision;
      const request = Promise.resolve().then(load).then(next => {
        if (revision === startedAt) { value = next; updatedAt = Date.now(); }
        return revision === startedAt || value === undefined ? next : value;
      }).finally(() => { if (pending === request) pending = undefined; });
      pending = request;
      return request;
    },
  };
}
