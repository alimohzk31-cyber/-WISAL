import { useEffect, useState } from 'react';
import { useLocation, useMatch } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Service } from './useServices';
import { useServices } from '../context/ServicesContext';

const rpcEnabled = (import.meta as any).env.VITE_SERVICE_VIEWS_RPC_ENABLED === 'true';

export async function recordServiceVisit(service: Service): Promise<number | undefined> {
  const id = Number(service.id);
  if (!rpcEnabled || service.status !== 'approved' || !Number.isSafeInteger(id) || id <= 0
    || (typeof navigator !== 'undefined' && navigator.onLine === false)) return undefined;
  try {
    const { data, error } = await supabase.rpc('increment_service_views', { p_service_id: id });
    if (error) throw error;
    const value = data == null ? NaN : Number(data);
    return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  } catch (error) {
    // Never retry an ambiguous write: the server may have committed it already.
    console.warn('[service visits] Could not record visit:', error);
    return undefined;
  }
}

interface VisitRequest {
  promise: Promise<number | undefined>;
  consumers: number;
  disposeTimer?: ReturnType<typeof setTimeout>;
}

// One request per active history entry. This survives StrictMode effect replay
// and same-entry remounts, while cleanup lets a later reopen count again.
const activeVisitRequests = new Map<string, VisitRequest>();

export function useServiceVisits(service: Service) {
  const { applyServiceViewCount } = useServices();
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
      shared = { consumers: 0, promise: recordServiceVisit(service).then(value => {
        if (value !== undefined) applyServiceViewCount(id, value);
        return value;
      }) };
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
  }, [id, service.status, isServicePage, location.key, applyServiceViewCount]);

  const value = count?.id === id ? count.value : service.views;
  return value != null && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
