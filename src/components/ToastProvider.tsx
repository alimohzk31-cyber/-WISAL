import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

// Shared version of the existing SliderManager toast, with the same duration,
// queue limit, colors and animation. It survives closing the service form.
interface ToastItem {
  id: number;
  type: 'success' | 'error';
  message: string;
}
type PushToast = (type: ToastItem['type'], message: string) => void;
const ToastContext = createContext<PushToast | null>(null);

export function useToast() {
  const pushToast = useContext(ToastContext);
  if (!pushToast) throw new Error('useToast must be used within ToastProvider');
  return pushToast;
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const pushToast = useCallback<PushToast>((type, message) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev.slice(-2), { id, type, message }]);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(item => item.id !== id));
      timers.current.delete(timer);
    }, 4000);
    timers.current.add(timer);
  }, []);
  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);

  return <ToastContext.Provider value={pushToast}>
    {children}
    <div dir="rtl" className="fixed bottom-4 left-4 z-[150] max-w-[calc(100vw-2rem)] space-y-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold backdrop-blur-md bg-[var(--card)] ${
              toast.type === 'success' ? 'border-emerald-500/40 text-emerald-500' : 'border-red-500/40 text-red-500'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 aria-hidden="true" className="w-4 h-4 shrink-0" /> : <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0" />}
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  </ToastContext.Provider>;
}
