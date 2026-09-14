import { useEffect, useState } from 'react';

export const DEFAULT_DEBOUNCE_MS = 300;

export function useDebouncedValue<T>(value: T, delay = DEFAULT_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    // إلغاء المؤقت السابق يمنع تشغيل بحث قديم بعد وصول كتابة أحدث.
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}
