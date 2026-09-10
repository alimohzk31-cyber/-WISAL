import { useEffect, useRef, useState } from 'react';
import { useMatch } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Service } from './useServices';

// Enable only after the proposed RPC has been reviewed and installed manually.
const rpcEnabled = (import.meta as any).env.VITE_SERVICE_VIEWS_RPC_ENABLED === 'true';

export function useServiceVisits(service: Service) {
  const id = String(service.id ?? '');
  const detailRoute = useMatch('/service/:serviceId');
  const isServicePage = detailRoute?.params.serviceId === id;
  const request = useRef<{ id: string; promise: Promise<number | undefined> } | undefined>(undefined);
  const [count, setCount] = useState<{ id: string; value: number }>();

  useEffect(() => {
    if (!rpcEnabled || !isServicePage || service.status !== 'approved' || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) return;
    // Share only this mounted detail's request across StrictMode effect replay.
    // A new mount (reopen, Back/Forward or Refresh) always records a new visit.
    if (request.current?.id !== id) {
      request.current = { id, promise: (async () => {
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
    }
    let active = true;
    request.current.promise.then(value => { if (active && value !== undefined) setCount({ id, value }); });
    return () => { active = false; };
  }, [id, service.status, isServicePage]);

  const value = count?.id === id ? count.value : service.views;
  return value != null && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
