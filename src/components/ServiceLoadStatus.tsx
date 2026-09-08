import { useServices } from '../context/ServicesContext';

export default function ServiceLoadStatus() {
  const { loading, error, refreshServices } = useServices();
  if (error) return (
    <div role="alert" className="rounded-xl border border-[var(--border)] p-4 text-center space-y-3">
      <p>{error}</p>
      <button type="button" disabled={loading} onClick={() => void refreshServices()} className="rounded-xl px-4 py-2 bg-[var(--accent-primary)] text-white disabled:opacity-50">إعادة المحاولة</button>
    </div>
  );
  return loading ? <p role="status" className="p-4 text-center">جارٍ تحميل الخدمات...</p> : null;
}
