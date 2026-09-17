import { Bookmark, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import SocialFeed from '../components/SocialFeed';
import { useServices } from '../context/ServicesContext';
import { useSavedServices } from '../hooks/useSavedServices';

export default function SavedServicesPage() {
  const { publicServices, loading } = useServices();
  const { savedIds } = useSavedServices();
  const services = useMemo(
    () => publicServices.filter(service => service.id !== undefined && savedIds.has(String(service.id))),
    [publicServices, savedIds],
  );

  return (
    <div className="relative z-10 mx-auto w-full min-w-0 max-w-2xl space-y-5">
      <header className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-4 shadow-[var(--shadow)]">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)]">
          <Bookmark className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="break-words text-xl font-black text-[var(--text-primary)]">الخدمات المحفوظة</h1>
          <p className="mt-0.5 break-words text-xs font-bold text-[var(--text-muted)]">خدماتك المحفوظة على هذا الجهاز</p>
        </div>
      </header>

      {loading && publicServices.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold text-[var(--text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" /> جارٍ تحميل الخدمات…
        </div>
      ) : savedIds.size === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-16 text-center">
          <Bookmark className="mx-auto mb-4 h-10 w-10 text-[var(--text-muted)]" />
          <h2 className="text-lg font-bold text-[var(--text-primary)]">لا توجد خدمات محفوظة</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">اضغط «حفظ» في أي بطاقة لتجدها هنا لاحقًا.</p>
          <Link to="/?view=browse" className="mt-5 inline-flex rounded-xl bg-[var(--accent-primary)] px-5 py-2.5 text-sm font-bold text-white">العودة إلى التصفح</Link>
        </div>
      ) : (
        <SocialFeed
          services={services}
          showAddButton={false}
          emptyTitle="الخدمات المحفوظة غير متاحة حاليًا"
          emptyDescription="قد تكون إحدى الخدمات قيد المراجعة أو لم تعد منشورة."
        />
      )}
    </div>
  );
}
