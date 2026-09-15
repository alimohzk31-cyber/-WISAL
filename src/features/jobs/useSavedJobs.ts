import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'wisal_saved_jobs_v1';
const CHANGE_EVENT = 'wisal:saved-jobs-change';

function readSavedIds(): number[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

export function useSavedJobs() {
  const [savedIds, setSavedIds] = useState<number[]>(readSavedIds);

  useEffect(() => {
    const sync = () => setSavedIds(readSavedIds());
    window.addEventListener('storage', sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const toggleSaved = useCallback((jobId: number) => {
    const current = readSavedIds();
    const next = current.includes(jobId) ? current.filter(id => id !== jobId) : [...current, jobId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSavedIds(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return next.includes(jobId);
  }, []);

  return {
    savedIds,
    isSaved: (jobId: number) => savedIds.includes(jobId),
    toggleSaved,
  };
}
