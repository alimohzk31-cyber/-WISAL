import { useMemo, useRef, useState, useEffect } from 'react';
import { useParams, useOutletContext, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, MapPin, Phone, Clock, Briefcase, Navigation, UserPlus, XCircle, Hourglass } from 'lucide-react';
import { colorMap, colorMapRedWhite } from '../data/categories';
import { useCategories } from '../hooks/useCategories';
import { useCategoryDirectory } from '../hooks/useCategoryDirectory';
import { useServices } from '../context/ServicesContext';
import { Service } from '../hooks/useServices';
import AddServiceModal from '../components/AddServiceModal';
import ServiceDetailModal from '../components/ServiceDetailModal';
import SafeImage from '../components/SafeImage';
import ServiceLoadStatus from '../components/ServiceLoadStatus';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import { categoryUrl, directoryEntryState, getDirectoryNavigationState, directoryBackAction, readCategoryUrl } from '../lib/directoryNavigation';

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
        {visibleServices.map(renderCard)}
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="py-8 space-y-4">
          {/* Loading Skeleton خفيف أثناء إضافة الدفعة التالية (لا يظهر للشبكة ولا طلبات — عرض محلي فقط) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6" aria-hidden="true">
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
  const { categories, loading: categoriesLoading, error: categoriesError, refreshCategories } = useCategories();
  const { t } = useLanguage();
  
  const { publicServices } = useServices();
  const { sections, locateCategory, locateService, bySection, resolveRoute } = useCategoryDirectory(categories, publicServices);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const routePlacement = resolveRoute(id ?? '', searchParams.get('sub') ?? undefined);
  const category = sections.find(item => item.slug === routePlacement?.sectionSlug);
  const [isAddingService, setIsAddingService] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const activeSubCategory = routePlacement?.childSlug ?? 'all';
  const { primaryColor, theme } = useOutletContext<{ primaryColor: string, theme: string }>();
  
  // Modal details belong to the current directory entry only.
  useEffect(() => {
    setSelectedService(null);
    setIsAddingService(false);
  }, [location.key]);

  if (!category) {
    return <div className="text-center py-20 space-y-4">
      <p role={categoriesError ? 'alert' : 'status'}>{categoriesLoading ? 'جارٍ تحميل القسم...' : categoriesError || 'القسم غير موجود'}</p>
      {categoriesError && <button type="button" disabled={categoriesLoading} onClick={() => void refreshCategories()} className="underline">إعادة المحاولة</button>}
      <button type="button" onClick={() => navigate('/?view=services', { replace: true })} className="block mx-auto underline">العودة للأقسام</button>
    </div>;
  }

  const subCategories = [{ slug: 'all', name: 'الكل' }, ...category.children];
  const activeChild = category.children.find(child => child.slug === activeSubCategory);
  const navigationState = getDirectoryNavigationState(location.state);
  const previousRoute = readCategoryUrl(navigationState.directoryPrevious);
  const previousPlacement = previousRoute && resolveRoute(previousRoute.slug, previousRoute.childSlug);
  const goBack = () => {
    const action = directoryBackAction({
      state: location.state, parentUrl: categoryUrl(category.slug), isChild: Boolean(activeChild),
      previousIsParent: previousPlacement?.sectionSlug === category.slug && !previousPlacement.childSlug,
      hasHistory: Number(window.history.state?.idx) > 0,
    });
    if ('delta' in action) navigate(action.delta);
    else navigate(action.to, { replace: action.replace, state: action.state });
  };
  const chooseSubCategory = (slug: string) => {
    if (slug === activeSubCategory) return;
    if (slug === 'all') { goBack(); return; }
    navigate(categoryUrl(category.slug, slug), {
      // Switching between siblings preserves the real parent history entry.
      replace: Boolean(activeChild),
      state: activeChild ? navigationState : directoryEntryState(location),
    });
  };

  // قاعدة الظهور (منطقية في البيانات نفسها - لا CSS إخفاء):
  // - approved: تظهر للجميع في قسمها الأصلي.
  // - pending / rejected: تظهر لصاحبها فقط (نفس owner_id/الجهاز) كخدمة مقفلة 🔒.
  //   لا تظهر للعامة إطلاقاً قبل موافقة المدير.
  const categoryServices = (bySection.get(category.slug) ?? []).filter(service =>
    activeSubCategory === 'all' || locateService(service)?.childSlug === activeSubCategory
  );
  const joinCategory = category.sources.find(source => source.dbId != null && locateCategory(source.slug)?.childSlug === activeSubCategory)
    ?? category.sources.find(source => source.dbId != null);
  // The directory resolves icons locally, including legacy custom categories.
  const Icon = category.icon;
  // Buttons/functional elements keep the theme accent palette (unchanged).
  // Only the category icon visuals switch to Red & White (no neon/glow).
  const colors = colorMap[category.color as keyof typeof colorMap] || colorMap['green'];
  const iconColors = colorMapRedWhite[category.color as keyof typeof colorMapRedWhite] || colorMapRedWhite['green'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      <ServiceLoadStatus />
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 border-b pb-6 relative border-[var(--border)]">
        <button type="button" onClick={goBack} aria-label={activeChild ? 'الرجوع إلى القسم الرئيسي' : 'الرجوع إلى مصدر الدخول'} className="p-2 rounded-full transition-colors hover:bg-[var(--accent-soft)] text-[var(--text-primary)]">
          <ArrowRight className="w-6 h-6" />
        </button>
        <div className="w-12 h-12 rounded-xl bg-white border-2 border-[#D90429] flex items-center justify-center">
          {Icon && typeof Icon !== 'string' && <Icon className={`w-6 h-6 ${iconColors.text}`} />}
        </div>
        <h1 className="text-3xl font-bold flex items-center gap-3 text-[var(--text-primary)]">
          <span style={{ color: 'var(--accent-primary)' }}>{category.name}{activeChild ? ` — ${activeChild.name}` : ''}</span>
          <MapPin className={`w-6 h-6 ${iconColors.text} animate-bounce`} />
        </h1>
        <span className="px-3 py-1 rounded-full text-sm font-bold bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
          {categoryServices.filter(s => s.status === 'approved').length} {t('approved_services')}
        </span>
        
        <button
          onClick={() => setIsAddingService(true)}
          className={`mr-auto flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all ${colors.bg} text-[var(--accent-contrast)] ${colors.shadow} hover:scale-105`}
        >
          <UserPlus className="w-5 h-5" />
          {t('join_section')}
        </button>
      </div>

      {/* All specialties are local display filters over the original services. */}
      {category.children.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2" role="group" aria-label="الأقسام الفرعية">
          {subCategories.map(sub => (
            <button
              key={sub.slug}
              aria-pressed={activeSubCategory === sub.slug}
              onClick={() => chooseSubCategory(sub.slug)}
              className={`px-4 py-2 rounded-full font-bold transition-all whitespace-nowrap border ${
                activeSubCategory === sub.slug 
                  ? `${colors.bg} text-[var(--accent-contrast)] border-transparent shadow-lg` 
                  : `bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]`
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      {/* Services List — عرض تدريجي: أول مجموعة فورًا ثم دفعات عند التمرير */}
      {categoryServices.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center bg-[var(--bg-secondary)]">
            {Icon && typeof Icon !== 'string' && <Icon className="w-10 h-10 text-[var(--text-muted)]" />}
          </div>
          <h3 className="text-xl font-bold text-[var(--text-primary)]">{t('no_services_yet')}</h3>
          <p className="font-medium text-[var(--text-muted)]">{t('be_first')}</p>
        </div>
      ) : (
        <ServicesGrid
          services={categoryServices}
          locateService={locateService}
          pageSize={PAGE_SIZE}
          renderCard={service => (
            <motion.div
              key={service.slug}
              layoutId={`service-${service.slug}`}
              onClick={() => setSelectedService(service)}
              className={`group relative border rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 flex flex-col z-10 cursor-pointer bg-[var(--card)] border-[var(--border)] shadow-[var(--shadow)] ${service.status === 'pending' ? 'opacity-70 saturate-50' : ''} ${service.status === 'rejected' ? 'opacity-50 saturate-0' : ''}`}
            >
              {/* Status Badges */}
              {service.isOffline && (
                <div className="absolute top-2 left-2 z-20 bg-blue-500/90 text-white text-[8px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm animate-pulse">
                  أوفلاين
                </div>
              )}

              {/* Pending Status Badge */}
              {service.status === 'pending' && (
                <div className="absolute top-2 right-2 z-20 bg-yellow-500/90 text-white text-[8px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm flex items-center gap-1">
                  <Hourglass className="w-3 h-3" />
                  ⏳ بانتظار موافقة الإدارة
                </div>
              )}

              {/* Rejected Status Badge */}
              {service.status === 'rejected' && (
                <div className="absolute top-2 right-2 z-20 bg-red-500/90 text-white text-[8px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  مرفوضة
                </div>
              )}

              {/* Simple Image Section */}
              <div className="aspect-square overflow-hidden relative">
                <SafeImage
                  src={service.image}
                  alt={service.name}
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
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
              <div className="p-3 flex-1 flex flex-col justify-between gap-1">
                <h3 className="text-sm md:text-base font-bold line-clamp-1 text-[var(--text-primary)]">
                  {service.name}
                </h3>
                
                {service.profession && (
                  <p className="text-[10px] md:text-xs font-medium line-clamp-1 text-[var(--text-secondary)]">
                    {service.profession}
                  </p>
                )}

                {/* Pending Status Message */}
                {service.status === 'pending' && (
                  <p className="text-[10px] md:text-xs font-bold text-yellow-500 flex items-center gap-1">
                    <Hourglass className="w-3 h-3 shrink-0" />
                    ⏳ بانتظار موافقة الإدارة
                  </p>
                )}

                {/* Rejected Status Message */}
                {service.status === 'rejected' && (
                  <p className="text-[10px] md:text-xs font-bold text-red-500 flex items-center gap-1">
                    <XCircle className="w-3 h-3 shrink-0" />
                    مرفوضة {service.rejectionReason ? `- ${service.rejectionReason}` : ''}
                  </p>
                )}

                {/* Navigation Links (Compact) - Only for approved services */}
                {Number.isFinite(service.latitude) && Number.isFinite(service.longitude) && service.status === 'approved' && (
                  <div className="flex gap-1 mt-1">
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
        <AddServiceModal 
          initialCategorySlug={joinCategory?.slug ?? ''}
          onClose={() => setIsAddingService(false)} 
        />
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
