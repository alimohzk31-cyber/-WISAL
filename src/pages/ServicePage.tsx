import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useServices } from '../context/ServicesContext';
import { useCategories } from '../hooks/useCategories';
import { useCategoryDirectory } from '../hooks/useCategoryDirectory';
import { logSupabaseError, mapRowToService, SERVICE_DETAIL_COLUMNS, type Service } from '../hooks/useServices';
import { supabase } from '../lib/supabase';
import { createRequestCache } from '../lib/requestCache';
import { fetchCategoryRows } from '../lib/categoryRows';
import LoadingState from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { categoryUrl, getDirectoryNavigationState, readCategoryUrl, type ServiceNavigationState } from '../lib/directoryNavigation';
import { colorMap } from '../data/categories';
import ServiceDetailModal from '../components/ServiceDetailModal';

// ---------------------------------------------------------------------------
// كاش جلسة لنتائج صفحة الخدمة — التنقل المتكرر (دخول/رجوع) بين صفحة الخدمة
// والتصفح لا يعيد استعلام Supabase عن الخدمة نفسها ضمن TTL، بل يعيد آخر
// نتيجة معروفة فوراً. عند انتهاء TTL يُجلب التحديث بالخلفية دون أي مؤشر تحميل
// ما دامت الخدمة معروضة أصلاً من publicServices (البيانات المعتمدة المحلية).
// ---------------------------------------------------------------------------
const SERVICE_PAGE_TTL = 60 * 1000;
const detailRequests = new Map<string, ReturnType<typeof createRequestCache<any>>>();
let serviceFetchCache: {
  id: string;
  at: number;
  error: boolean;
  result: { id: string; service?: Service; error?: boolean };
} | null = null;

export default function ServicePage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useOutletContext<{ theme: string }>();
  const { publicServices } = useServices();
  const { categories } = useCategories();
  const { locateService, sections } = useCategoryDirectory(categories, publicServices);
  const [result, setResult] = useState<{ id: string; service?: Service; error?: boolean }>();
  const [attempt, setAttempt] = useState(0);
  const validId = Number.isSafeInteger(Number(serviceId)) && Number(serviceId) > 0;
  const cachedService = publicServices.find(item => String(item.id) === serviceId);
  const current = result?.id === serviceId ? result : undefined;
  const service = current?.error ? cachedService : current ? current.service : cachedService;

  // Fetch this primary key directly, including on Refresh; do not wait for the
  // paginated directory to eventually load the service or fall back to a slug.
  useEffect(() => {
    if (!validId) return;
    let active = true;

    // كاش جلسة سليم: العودة لنفس الخدمة خلال TTL لا تلمس الشبكة إطلاقاً.
    // (ما عدا إعادة المحاولة اليدوية بعد خطأ — attempt يفرض جلباً جديداً)
    if (attempt === 0 && serviceFetchCache && serviceFetchCache.id === serviceId &&
        !serviceFetchCache.error && Date.now() - serviceFetchCache.at < SERVICE_PAGE_TTL) {
      setResult(serviceFetchCache.result);
      return;
    }

    async function loadService() {
      try {
        let read = detailRequests.get(serviceId!);
        if (!read) {
          read = createRequestCache<any>(SERVICE_PAGE_TTL);
          if (detailRequests.size >= 40) detailRequests.delete(detailRequests.keys().next().value!);
          detailRequests.set(serviceId!, read);
        }
        const data = await read.get(async () => {
          const { data, error } = await supabase.from('services').select(SERVICE_DETAIL_COLUMNS).eq('id', serviceId).eq('status', 'approved').maybeSingle();
          if (error) throw error;
          const row = data as any;
          if (row && !row.category_slug && row.category_id != null) {
            const categories = await fetchCategoryRows();
            const category = categories.find(categoryRow => String(categoryRow.id) === String(row.category_id));
            return { ...row, category_slug: category?.slug };
          }
          return row;
        }, attempt > 0);
        if (!active) return;
        const next = { id: serviceId!, service: data ? mapRowToService(data) : undefined };
        serviceFetchCache = { id: serviceId!, at: Date.now(), error: false, result: next };
        setResult(next);
      } catch (error) {
        if (!active) return;
        logSupabaseError('ServicePage', error);
        const next = { id: serviceId!, error: true };
        serviceFetchCache = { id: serviceId!, at: Date.now(), error: true, result: next };
        setResult(next);
      }
    }
    void loadService();
    return () => { active = false; };
  }, [serviceId, validId, attempt]);

  const state = location.state as ServiceNavigationState | null;
  const placement = service ? locateService(service) : undefined;
  const savedCategoryUrl = readCategoryUrl(state?.serviceCategoryUrl) ? state!.serviceCategoryUrl : undefined;
  const parentUrl = savedCategoryUrl ?? (placement
    ? categoryUrl(placement.sectionSlug, placement.childSlug)
    : service?.categorySlug || state?.categorySlug
      ? categoryUrl(service?.categorySlug || state!.categorySlug)
      : getDirectoryNavigationState(state).directoryOrigin);
  const goBack = () => {
    // HashRouter/WebView history indexes are not reliable enough to use -1
    // here. Always replace details with the validated category URL so Back
    // cannot land on an intermediate or invalid hash entry (white screen).
    navigate(parentUrl, {
      replace: true,
      state: { directoryOrigin: getDirectoryNavigationState(state).directoryOrigin },
    });
  };

  if (!validId || !service) {
    const back = (
      <button type="button" onClick={goBack} className="mx-auto block font-bold text-[var(--accent-primary)]">رجوع</button>
    );
    if (validId && !current) return <LoadingState label="جارٍ تحميل الخدمة…" />;
    if (current?.error) {
      return (
        <div className="py-20 text-center space-y-4">
          <ErrorState message="تعذر تحميل الخدمة" className="py-0" onRetry={() => {
            setResult(undefined);
            setAttempt(value => value + 1);
          }} />
          {back}
        </div>
      );
    }
    return (
      <div className="py-20 text-center space-y-4">
        <EmptyState title="الخدمة غير موجودة أو غير متاحة" />
        {back}
      </div>
    );
  }

  const category = sections.find(item => item.slug === placement?.sectionSlug);
  const colors = colorMap[category?.color as keyof typeof colorMap] ?? colorMap.green;
  // Keep the fixed dialog outside Layout's transformed route-transition wrapper.
  return createPortal(
    <ServiceDetailModal key={`${location.key}:${serviceId}`} service={service} onClose={goBack} theme={theme} colors={colors} />,
    document.body,
  );
}
