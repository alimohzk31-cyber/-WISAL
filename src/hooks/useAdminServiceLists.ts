import { useCallback, useEffect, useRef, useState } from 'react';
import type { Service } from './useServices';
import type { ServiceChange } from '../lib/serviceChanges';
import { supabase } from '../lib/supabase';
import { measureAdminOperation } from '../lib/adminPerformance';

export function useAdminServiceLists(
  fetchPending: () => Promise<Service[]>,
  fetchRejected: () => Promise<Service[]>,
  refreshPublic: () => Promise<void>,
) {
  const [pending, setPending] = useState<Service[]>([]);
  const [rejected, setRejected] = useState<Service[]>([]);
  const refresh = useRef<(force: boolean) => void>(() => {});

  useEffect(() => {
    let disposed = false;
    let running = false;
    let queued = false;
    let refreshPublicQueued = false;
    let revision = 0;
    let lastLoaded = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      if (disposed || running) return;
      running = true;
      queued = false;
      const version = revision;
      const includePublic = refreshPublicQueued;
      refreshPublicQueued = false;
      if (includePublic) void refreshPublic();
      try {
        const lists = await measureAdminOperation('admin.lists', () => Promise.all([fetchPending(), fetchRejected()]));
        // An older response must never undo a committed approve/reject/insert.
        if (!disposed && version === revision) {
          setPending(lists[0]);
          setRejected(lists[1]);
          lastLoaded = Date.now();
        }
      } catch {
        // Keep the last successful lists on transient failure, rather than showing empty lists.
      } finally {
        running = false;
        if (!disposed && queued) schedule();
      }
    };
    const schedule = () => {
      queued = true;
      if (running || timer !== undefined || disposed) return;
      timer = setTimeout(() => { timer = undefined; void run(); }, 200);
    };
    const invalidate = (includePublic = false) => {
      revision++;
      refreshPublicQueued ||= includePublic;
      schedule();
    };
    refresh.current = (force) => {
      if (force) invalidate();
      else if (Date.now() - lastLoaded > 10000 && !running) schedule();
    };
    const committed = (event: Event) => {
      const change = (event as CustomEvent<ServiceChange>).detail;
      if (change.kind === 'created') { invalidate(); return; }
      revision++;
      if (running) queued = true;
      const id = change.kind === 'deleted' ? change.id : change.service.id;
      const apply = (list: Service[], status: Service['status']) => {
        const remaining = list.filter(service => String(service.id) !== String(id));
        return change.kind === 'updated' && change.service.status === status
          ? [change.service, ...remaining].sort((a, b) => b.createdAt - a.createdAt)
          : remaining;
      };
      setPending(list => apply(list, 'pending'));
      setRejected(list => apply(list, 'rejected'));
    };
    const visible = () => {
      if (document.visibilityState === 'visible') refresh.current(false);
    };
    window.addEventListener('services:committed', committed);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    // Read-only fallback when Realtime is unavailable or an event is missed.
    const poll = setInterval(visible, 30000);
    const channel = supabase.channel('admin-services-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => invalidate(true))
      .subscribe();
    void run();
    return () => {
      disposed = true;
      refresh.current = () => {};
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener('services:committed', committed);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
      void supabase.removeChannel(channel);
    };
  }, [fetchPending, fetchRejected, refreshPublic]);

  const reload = useCallback((force = true) => { refresh.current(force); }, []);
  return { pending, rejected, setPending, setRejected, reload };
}
