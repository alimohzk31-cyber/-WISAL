import { useCallback, useEffect, useState } from 'react';
import { getOwnerId } from './useServices';

const SAVED_SERVICES_KEY_PREFIX = 'wisal_saved_services';
const SAVED_SERVICES_EVENT = 'wisal:saved-services-changed';

function storageKey(): string {
  return `${SAVED_SERVICES_KEY_PREFIX}:${getOwnerId()}`;
}

export function readSavedServiceIds(): Set<string> {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey()) ?? '[]');
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter(item => typeof item === 'string' || typeof item === 'number').map(String));
  } catch {
    return new Set();
  }
}

function writeSavedServiceIds(ids: Set<string>) {
  localStorage.setItem(storageKey(), JSON.stringify([...ids]));
  window.dispatchEvent(new CustomEvent(SAVED_SERVICES_EVENT));
}

export function useSavedServices() {
  const [savedIds, setSavedIds] = useState<Set<string>>(() => readSavedServiceIds());

  useEffect(() => {
    const refresh = () => setSavedIds(readSavedServiceIds());
    window.addEventListener('storage', refresh);
    window.addEventListener(SAVED_SERVICES_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(SAVED_SERVICES_EVENT, refresh);
    };
  }, []);

  const toggleSaved = useCallback((serviceId: string | number) => {
    const id = String(serviceId);
    const next = readSavedServiceIds();
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeSavedServiceIds(next);
  }, []);

  return { savedIds, toggleSaved };
}
