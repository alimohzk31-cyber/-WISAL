import { useEffect, useState } from 'react';
import { useLocation, useMatch } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Service } from './useServices';

// Enable only after the proposed RPC has been reviewed and installed manually.
const rpcEnabled = (import.meta as any).env.VITE_SERVICE_VIEWS_RPC_ENABLED === 'true';

interface VisitRequest {
  promise: Promise<number | undefined>;
  consumers: number;
  disposeTimer?: ReturnType<typeof setTimeout>;
}

// One request per active history entry. This survives StrictMode effect replay
// and same-entry remounts, while cleanup lets a later reopen count again.
const activeVisitRequests = new Map<string, VisitRequest>();

export function useServiceVisits(service: Service) {
  const id = String(service.id ?? '');
  const location = useLocation();
  const detailRoute = useMatch('/service/:serviceId');
  const isServicePage = detailRoute?.params.serviceId === id;
  const [count, setCount] = useState<{ id: string; value: number }>();

  useEffect(() => {
    if (!rpcEnabled || !isServicePage || service.status !== 'approved' || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) return;
    const visitKey = `${location.key}:${id}`;
    let shared = activeVisitRequests.get(visitKey);
    if (!shared) {
      shared = { consumers: 0, promise: (async () => {
        try {
          const { data, error } = await supabase.rpc('increment_service_views', { p_service_id: Number(id) });
          if (error) throw error;
          const value = data == null ? NaN : Number(data);
          return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
        } catch (error) {
          // Do not retry: a lost response may still have committed the visit.
          console.warn('[service visits] Could not record visit:', error);
          return undefined;
        }
      })() };
      activeVisitRequests.set(visitKey, shared);
    }
    if (shared.disposeTimer) clearTimeout(shared.disposeTimer);
    shared.disposeTimer = undefined;
    shared.consumers += 1;
    let active = true;
    shared.promise.then(value => { if (active && value !== undefined) setCount({ id, value }); });
    return () => {
      active = false;
      shared!.consumers -= 1;
      if (shared!.consumers === 0) {
        shared!.disposeTimer = setTimeout(() => {
          if (shared!.consumers === 0 && activeVisitRequests.get(visitKey) === shared) {
            activeVisitRequests.delete(visitKey);
          }
        }, 0);
      }
    };
  }, [id, service.status, isServicePage, location.key]);

  const value = count?.id === id ? count.value : service.views;
  return value != null && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
