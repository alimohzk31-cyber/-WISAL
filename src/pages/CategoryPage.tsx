import { lazy, Suspense, useMemo, useRef, useState, useEffect } from 'react';
import { useParams, useOutletContext, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Phone, XCircle, Hourglass, Plus, Search } from 'lucide-react';
import { colorMap } from '../data/categories';
import { useCategories } from '../hooks/useCategories';
import { useCategoryDirectory } from '../hooks/useCategoryDirectory';
import { useServices } from '../context/ServicesContext';
import { Service } from '../hooks/useServices';
const AddServiceModal = lazy(() => import('../components/AddServiceModal'));
import ServiceDetailModal from '../components/ServiceDetailModal';
import { LazyServiceCardImage } from '../components/LazyServiceMedia';
import ServiceStatusBadge from '../components/ServiceStatusBadge';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import CategoryPageHero from '../components/CategoryPageHero';
import CategoryToolbar from '../components/CategoryToolbar';
import CategoryPhoto from '../components/CategoryPhoto';
import { getCategoryVisual } from '../data/categoryVisuals';
import { motion, AnimatePresence } from 'motion/react';
import { serviceStatusOverlayClass } from '../types/models';
import { categoryUrl, directoryEntryState, getDirectoryNavigationState, directoryBackAction, readCategoryUrl, openServiceDetails } from '../lib/directoryNavigation';
import ServicePublicationTime from '../components/ServicePublicationTime';
import { pickJoinTarget } from '../lib/serviceCategorySelection';

// ---------------------------------------------------------------------------
// تحميل تدريجي (Progressive Rendering) لبطاقات الخدمات داخل القسم:
// المشكلة الأصلية: مع وجود عشرات/مئات الخدمات في القسم الواحد كانت كل البطاقات
// تُركَّب دفعة واحدة (كل واحدة فيها صورة + أنيميشن motion) → تجميد الواجهة
// على GitHub Pages والهواتف حتى تنتهي كل عمليات الرسم وطلبات الصور.
// الحل: نعرض أول مجموعة بسرعة (دون انتظار أي طلب شبكة)، ثم نضيف الدفعات
// التالية تلقائيًا عند تمرير المستخدم قرب النهاية (IntersectionObserver)،
// مع زر «عرض المزيد» كخيار يدوي. لا pagination من قاعدة البيانات — نفس
// البيانات المحلية المعتمدة، فقط عرضها يصبح تدريجيًا.
// ---------------------------------------------------------------------------
const PAGE_SIZE = 12;

function ServicesGrid({ services, locateService, renderCard, pageSize }: {
  services: Service[];
  locateService: (service: Pick<Service, 'categorySlug' | 'categoryId' | 'subCategory' | 'profession'>) => { sectionSlug: string; childSlug?: string } | undefined;
  renderCard: (service: Service) => React.ReactNode;
  pageSize: number;
}) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // عند تغيّر القسم/التصنيف الفرعي نبدأ من المجموعة الأولى فورًا (بدون إعادة جلب أي شيء).
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [services, pageSize]);

  const visibleServices = useMemo(() => services.slice(0, visibleCount), [services, visibleCount]);
  const hasMore = visibleCount < services.length;

  // Infinite loading: عند اقتراب المستخدم من نهاية القائمة نضيف الدفعة التالية.
  // العناصر الجديدة فقط هي التي تُركَّب، فلا يُعاد رسم البطاقات القديمة.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setVisibleCount(count => Math.min(count + pageSize, services.length));
        }
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, pageSize, services.length]);

  return (
    <div>
      <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {visibleServices.map(renderCard)}
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="py-8 space-y-4">
          {/* Loading Skeleton خفيف أثناء إضافة الدفعة التالية (لا يظهر للشبكة ولا طلبات — عرض محلي فقط) */}
          <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 lg:grid-cols-4" aria-hidden="true">
            {Array.from({ length: Math.min(pageSize, services.length - visibleCount) }).map((_, index) => (
              <div key={index} className="border rounded-2xl overflow-hidden bg-[var(--card)] border-[var(--border)]">
                <div className="aspect-square animate-pulse bg-[var(--bg-secondary)]" />
                <div className="p-3 space-y-2">
                  <div className="h-3.5 w-3/4 rounded animate-pulse bg-[var(--bg-secondary)]" />
                  <div className="h-2.5 w-1/2 rounded animate-pulse bg-[var(--bg-secondary)]" />
                </div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <button
              type="button"
              onClick={() => setVisibleCount(count => Math.min(count + pageSize, services.length))}
              className="px-6 py-2.5 rounded-xl font-bold border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all"
            >
              عرض المزيد
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const { categories } = useCategories();
  const { publicServices, loading: servicesLoading } = useServices();
  const { sections, locateCategory, locateService, bySection, resolveRoute } = useCategoryDirectory(categories, publicServices);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  // ---------------- اختيار القسم الفرعي (الإصلاح الجذري) ----------------
  // احترام نية المستخدم الصريحة: sub=all أو غياب المعامل تماماً يعني عرض كل
  // خدمات القسم (بما فيها الخدمات التابعة للقسم الرئيسي دون تخصص فرعي).
  // سابقاً كان resolveRoute يفرض "أول قسم فرعي" افتراضياً حتى بدون sub=،
  // وكانت فلترة الصفحة تلتزم به افتراضياً فتُخفي كل الخدمات التي لا childSlug
  // لها رغم ظهورها في صفحة التصفح — وهذا هو سبب "القسم يفتح فارغاً".
  const rawSub = searchParams.get('sub');
  const hasExplicitSubCategory = rawSub != null && rawSub !== '' && rawSub !== 'all';
  const routePlacement = resolveRoute(id ?? '', hasExplicitSubCategory ? rawSub : undefined);
  const category = sections.find(item => item.slug === routePlacement?.sectionSlug);
  const [isAddingService, setIsAddingService] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  // sub=all أو بلا sub => view كل الأقسام؛ مع sub صريح => view ذلك الفرع فقط.
  const activeSubCategory = hasExplicitSubCategory ? (routePlacement?.childSlug ?? 'all') : 'all';
  const { primaryColor, theme } = useOutletContext<{ primaryColor: string, theme: string }>();
  
  // Modal details belong to the current directory entry only.
  useEffect(() => {
    setSelectedService(null);
    setIsAddingService(false);
    setSearchTerm('');
  }, [location.key]);

  const categoryServices = useMemo(() => (bySection.get(category?.slug ?? '') ?? []).filter(service =>
    activeSubCategory === 'all' || locateService(service)?.childSlug === activeSubCategory
  ), [bySection, category?.slug, activeSubCategory, locateService]);
  const visibleCategoryServices = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('ar');
    const filtered = query
      ? categoryServices.filter(service => [service.name, service.profession, service.location]
        .some(value => value?.toLocaleLowerCase('ar').includes(query)))
      : [...categoryServices];
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  }, [categoryServices, searchTerm]);

  if (!category) {
    return <div className="text-center py-20 text-xl font-bold">القسم غير موجود</div>;
  }

  const subCategories = category.children;
  const activeChild = category.children.find(child => child.slug === activeSubCategory);
  const visual = getCategoryVisual(category.slug, activeChild?.slug);
  const navigationState = getDirectoryNavigationState(location.state);
  const previousRoute = readCategoryUrl(navigationState.directoryPrevious);
  const previousPlacement = previousRoute && resolveRoute(previousRoute.slug, previousRoute.childSlug);
  const goBack = () => {
    const action = directoryBackAction({
      state: location.state, parentUrl: categoryUrl(category.slug), isChild: Boolean(activeChild) && hasExplicitSubCategory && !category.hideAll,
      previousIsParent: previousPlacement?.sectionSlug === category.slug && !previousPlacement.childSlug,
      hasHistory: Number(window.history.state?.idx) > 0,
    });
    if ('delta' in action) navigate(action.delta);
    else navigate(action.to, { replace: action.replace, state: action.state });
  };
  const chooseSubCategory = (slug?: string) => {
    if (!slug) { goBack(); return; }
    if (slug === activeSubCategory) return;
    navigate(categoryUrl(category.slug, slug), {
      // Switching between siblings preserves the real parent history entry.
      replace: hasExplicitSubCategory,
      state: hasExplicitSubCategory ? navigationState : directoryEntryState(location),
    });
  };

  // قاعدة الظهور (منطقية في البيانات نفسها - لا CSS إخفاء):
  // - approved: تظهر للجميع في قسمها الأصلي.
  // - pending / rejected: تظهر لصاحبها فقط (نفس owner_id/الجهاز) كخدمة مقفلة 🔒.
  //   لا تظهر للعامة إطلاقاً قبل موافقة المدير.
  const joinSection = {
    slug: category.slug,
    name: activeChild ? `${category.name} (${activeChild.name})` : category.name,
    childSlug: activeChild?.slug,
    childName: activeChild?.name,
  };
  // هدف الانضمام: هوية القسم/الفرع تُمرَّر مباشرة إلى النموذج (id/slug)،
  // فلا نُعيد البحث عنه داخل قائمة قد لا تكون محمّلة أو تحتوي slug مختلفاً.
  // وإذا كان القسم معروفاً في الدليل لكن بلا صف في public.categories فلا نمنع
  // الإضافة: مسار الحفظ هو الذي يجهّز الصف المطابق للـ FK.
  const joinTarget = pickJoinTarget(
    category.sources.map(source => ({ slug: String(source.slug), name: source.name, dbId: source.dbId })),
    categories,
    joinSection,
    locateCategory,
    locateService,
  );
  // Keep the existing theme palette for service cards and action buttons.
  const colors = colorMap[category.color as keyof typeof colorMap] || colorMap['green'];

  return (
    <div className="relative w-full min-w-0 max-w-full space-y-6 animate-in fade-in duration-500">
      <CategoryPageHero
        sectionName={category.name}
        childName={activeChild?.name}
        visual={visual}
        count={categoryServices.length}
        children={subCategories}
        activeChildSlug={activeChild?.slug}
        hideAll={category.hideAll}
        onChildSelect={chooseSubCategory}
        onBack={goBack}
        onAdd={() => setIsAddingService(true)}
      />

      <CategoryToolbar
        searchTerm={searchTerm}
        onSearchTerm={setSearchTerm}
        placeholder={`البحث في قسم ${activeChild?.name ?? category.name}…`}
      />

      {/* Services List — عرض تدريجي: أول مجموعة فورًا ثم دفعات عند التمرير */}
      {servicesLoading && publicServices.length === 0 ? (
        <LoadingState label="جارٍ تحميل الخدمات…" />
      ) : categoryServices.length === 0 && !searchTerm.trim() ? (
        <section role="status" className="flex flex-col items-center pb-3 text-center">
          <div className="relative aspect-square w-full max-w-[376px]">
            <CategoryPhoto
              key={`empty-${visual.photoUrl}`}
              visual={visual}
              alt={activeChild ? `${category.name} - ${activeChild.name}` : category.name}
              className="h-full w-full rounded-full object-cover"
            />
            <button
              type="button"
              onClick={() => setIsAddingService(true)}
              aria-label="إضافة خدمة"
              className="absolute right-[11%] top-[58%] flex h-[90px] w-[90px] items-center justify-center rounded-full bg-[#168bf3] text-white shadow-[0_8px_20px_rgba(22,139,243,0.24)] transition hover:scale-105 active:scale-95"
            >
              <Plus className="h-10 w-10" strokeWidth={3} aria-hidden="true" />
            </button>
          </div>
          <h2 className="mt-3 text-[clamp(1.8rem,4.3vw,2.8rem)] font-black leading-tight text-[#172b4d]">لا توجد خدمات في هذا القسم حالياً</h2>
          <p className="mt-6 text-[clamp(1.2rem,2.8vw,1.75rem)] font-medium text-[#7789a3]">كن أول من يضيف خدمته في هذا القسم</p>
          <span aria-hidden="true" className="mt-5 h-[5px] w-[104px] rounded-full bg-[#0878ed]" />
        </section>
      ) : visibleCategoryServices.length === 0 ? (
        <EmptyState icon={Search} title="لا توجد نتائج مطابقة" subtitle="جرّب تغيير كلمات البحث أو التخصص المحدد." />
      ) : (
        <ServicesGrid
          services={visibleCategoryServices}
          locateService={locateService}
          pageSize={PAGE_SIZE}
          renderCard={service => (
            <motion.div
              key={service.slug}
              layoutId={`service-${service.slug}`}
              onClick={() => Number.isSafeInteger(Number(service.id)) && Number(service.id) > 0
                ? openServiceDetails(navigate, location, service, { sectionSlug: category.slug, childSlug: activeChild?.slug })
                : setSelectedService(service)}
              className={`group relative z-10 flex min-w-0 max-w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow)] transition-all duration-300 hover:-translate-y-1 ${serviceStatusOverlayClass(service.status)}`}
            >
              {/* Status Badges — مكوّن موحد ServiceStatusBadge */}
              {service.isOffline && (
                <div className="absolute top-2 left-2 z-20 bg-blue-500/90 text-white text-[8px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm animate-pulse">
                  أوفلاين
                </div>
              )}

              {/* Pending / Rejected Status Badge — مكوّن موحد */}
              <ServiceStatusBadge status={service.status ?? 'approved'} variant="card" />

              {/* Simple Image Section */}
              <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-[var(--bg-secondary)]">
                <LazyServiceCardImage service={service} className="h-full w-full object-contain object-center" />
                <div className={`absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent`} />
                
                {/* Quick Call Action Overlay */}
                {service.phone && service.status === 'approved' && (
                  <a 
                    href={`tel:${service.phone}`}
                    className={`absolute bottom-2 right-2 p-2 rounded-full shadow-lg transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ${colors.bg} text-[var(--accent-contrast)]`}
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>
              
              {/* Compact Info Section */}
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 p-3">
                <h3 className="text-sm md:text-base font-bold line-clamp-1 text-[var(--text-primary)]">
                  {service.name}
                </h3>
                
                {service.profession && (
                  <p className="text-[10px] md:text-xs font-medium line-clamp-1 text-[var(--text-secondary)]">
                    {service.profession}
                  </p>
                )}
                <ServicePublicationTime service={service} className="text-[9px] md:text-[10px] text-[var(--text-muted)]" />

                {/* Pending Status Message */}
                {service.status === 'pending' && (
                  <p className="flex min-w-0 items-start gap-1 break-words text-[10px] font-bold text-yellow-500 md:text-xs">
                    <Hourglass className="w-3 h-3 shrink-0" />
                    ⏳ بانتظار موافقة الإدارة
                  </p>
                )}

                {/* Rejected Status Message */}
                {service.status === 'rejected' && (
                  <p className="flex min-w-0 items-start gap-1 break-words text-[10px] font-bold text-red-500 md:text-xs">
                    <XCircle className="w-3 h-3 shrink-0" />
                    مرفوضة {service.rejectionReason ? `- ${service.rejectionReason}` : ''}
                  </p>
                )}

                {/* Navigation Links (Compact) - Only for approved services */}
                {service.latitude && service.longitude && service.status === 'approved' && (
                  <div className="mt-1 flex min-w-0 gap-1">
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${service.latitude},${service.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center py-1 rounded-md text-[9px] font-bold bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border)]"
                    >
                      خرائط
                    </a>
                    <a 
                      href={`https://waze.com/ul?ll=${service.latitude},${service.longitude}&navigate=yes`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center py-1 rounded-md text-[9px] font-bold bg-[var(--bg-secondary)] text-[#33ccff] border border-[var(--border)]"
                    >
                      ويز
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        />
      )}

      {isAddingService && (
        <Suspense fallback={null}>
        <AddServiceModal 
          joinSection={joinSection}
          initialCategory={joinTarget}
          initialCategorySlug={joinTarget.slug}
          initialProfession={activeChild?.name}
          onClose={() => setIsAddingService(false)} 
        />
        </Suspense>
      )}

      <AnimatePresence>
        {selectedService && (
          <ServiceDetailModal
            service={selectedService}
            onClose={() => setSelectedService(null)}
            theme={theme}
            colors={colors}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
