import { useMemo, useRef, useState, useEffect } from 'react';
import { useParams, useOutletContext, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, MapPin, Phone, Clock, Briefcase, Navigation, UserPlus, XCircle, Hourglass, Menu } from 'lucide-react';
import { colorMap, colorMapRedWhite } from '../data/categories';
import { useCategories } from '../hooks/useCategories';
import { useCategoryDirectory } from '../hooks/useCategoryDirectory';
import { useServices } from '../context/ServicesContext';
import { Service } from '../hooks/useServices';
import AddServiceModal from '../components/AddServiceModal';
import ServiceDetailModal from '../components/ServiceDetailModal';
import SafeImage from '../components/SafeImage';
import ServiceStatusBadge from '../components/ServiceStatusBadge';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../context/LanguageContext';
import { serviceStatusOverlayClass } from '../types/models';
import { categoryUrl, directoryEntryState, getDirectoryNavigationState, directoryBackAction, readCategoryUrl, openServiceDetails } from '../lib/directoryNavigation';
import ServicePublicationTime from '../components/ServicePublicationTime';

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
  const { categories } = useCategories();
  const { t } = useLanguage();
  
  const { publicServices, loading: servicesLoading } = useServices();
  const { sections, locateCategory, locateService, bySection, resolveRoute } = useCategoryDirectory(categories, publicServices);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const routePlacement = resolveRoute(id ?? '', searchParams.get('sub') ?? undefined);
  const category = sections.find(item => item.slug === routePlacement?.sectionSlug);
  const [isAddingService, setIsAddingService] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isSubcategoryMenuOpen, setIsSubcategoryMenuOpen] = useState(false);
  const subcategoryMenuRef = useRef<HTMLDivElement>(null);
  const activeSubCategory = routePlacement?.childSlug ?? 'all';
  const hasExplicitSubCategory = searchParams.has('sub');
  const { primaryColor, theme } = useOutletContext<{ primaryColor: string, theme: string }>();
  
  // Modal details belong to the current directory entry only.
  useEffect(() => {
    setSelectedService(null);
    setIsAddingService(false);
    setIsSubcategoryMenuOpen(false);
  }, [location.key]);

  useEffect(() => {
    if (!isSubcategoryMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!subcategoryMenuRef.current?.contains(event.target as Node)) setIsSubcategoryMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isSubcategoryMenuOpen]);

  if (!category) {
    return <div className="text-center py-20 text-xl font-bold">القسم غير موجود</div>;
  }

  const subCategories = category.children;
  const activeChild = category.children.find(child => child.slug === activeSubCategory);
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
  const chooseSubCategory = (slug: string) => {
    setIsSubcategoryMenuOpen(false);
    if (slug === activeSubCategory) return;
    if (slug === 'all') { goBack(); return; }
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
  const categoryServices = (bySection.get(category.slug) ?? []).filter(service =>
    activeSubCategory === 'all' || locateService(service)?.childSlug === activeSubCategory
  );
  const joinCategory = category.sources.find(source => source.dbId != null && locateCategory(source.slug)?.childSlug === activeSubCategory)
    ?? category.sources.find(source => source.dbId != null && (!activeChild ||
      locateService({ categorySlug: source.slug, categoryId: source.dbId, profession: activeChild.name })?.childSlug === activeChild.slug));
  // The directory resolves icons locally, including legacy custom categories.
  const Icon = category.icon;
  // Buttons/functional elements keep the theme accent palette (unchanged).
  // Only the category icon visuals switch to Red & White (no neon/glow).
  const colors = colorMap[category.color as keyof typeof colorMap] || colorMap['green'];
  const iconColors = colorMapRedWhite[category.color as keyof typeof colorMapRedWhite] || colorMapRedWhite['green'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 border-b pb-6 relative border-[var(--border)]">
        <button type="button" onClick={goBack} aria-label={activeChild && !category.hideAll ? 'الرجوع إلى القسم الرئيسي' : 'الرجوع إلى مصدر الدخول'} className="p-2 rounded-full transition-colors hover:bg-[var(--accent-soft)] text-[var(--text-primary)]">
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

        {category.children.length > 0 && (
          <div className="relative" ref={subcategoryMenuRef}>
            <button
              type="button"
              onClick={() => setIsSubcategoryMenuOpen(open => !open)}
              aria-expanded={isSubcategoryMenuOpen}
              aria-controls="subcategory-menu"
              aria-label="عرض الأقسام الفرعية"
              className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-bold text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--accent-soft)]"
            >
              <Menu className="h-5 w-5 text-[var(--accent-primary)]" aria-hidden="true" />
              <span className="max-w-32 truncate">{activeChild?.name ?? 'كل الأقسام'}</span>
            </button>

            <AnimatePresence>
              {isSubcategoryMenuOpen && (
                <motion.div
                  id="subcategory-menu"
                  role="menu"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-full z-30 mt-2 max-h-[60vh] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2 shadow-[var(--shadow-lg)]"
                >
                  {subCategories.map(sub => {
                    const isActive = activeSubCategory === sub.slug;
                    return (
                      <button
                        key={sub.slug}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        onClick={() => chooseSubCategory(sub.slug)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-right text-sm font-bold transition-colors ${
                          isActive
                            ? `${colors.bg} text-[var(--accent-contrast)]`
                            : 'text-[var(--text-primary)] hover:bg-[var(--accent-soft)]'
                        }`}
                      >
                        <span>{sub.name}</span>
                        {isActive && <span className="h-2 w-2 shrink-0 rounded-full bg-current" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        <button
          onClick={() => setIsAddingService(true)}
          className={`mr-auto flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all ${colors.bg} text-[var(--accent-contrast)] ${colors.shadow} hover:scale-105`}
        >
          <UserPlus className="w-5 h-5" />
          {t('join_section')}
        </button>
      </div>

      {/* Services List — عرض تدريجي: أول مجموعة فورًا ثم دفعات عند التمرير */}
      {servicesLoading && publicServices.length === 0 ? (
        <LoadingState label="جارٍ تحميل الخدمات…" />
      ) : categoryServices.length === 0 ? (
        <EmptyState
          icon={Icon && typeof Icon !== 'string' ? Icon : undefined}
          title={t('no_services_yet')}
          subtitle={t('be_first')}
        />
      ) : (
        <ServicesGrid
          services={categoryServices}
          locateService={locateService}
          pageSize={PAGE_SIZE}
          renderCard={service => (
            <motion.div
              key={service.slug}
              layoutId={`service-${service.slug}`}
              onClick={() => Number.isSafeInteger(Number(service.id)) && Number(service.id) > 0
                ? openServiceDetails(navigate, location, service, { sectionSlug: category.slug, childSlug: activeChild?.slug })
                : setSelectedService(service)}
              className={`group relative border rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 flex flex-col z-10 cursor-pointer bg-[var(--card)] border-[var(--border)] shadow-[var(--shadow)] ${serviceStatusOverlayClass(service.status)}`}
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
                <ServicePublicationTime service={service} className="text-[9px] md:text-[10px] text-[var(--text-muted)]" />

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
                {service.latitude && service.longitude && service.status === 'approved' && (
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
          joinSection={{ slug: category.slug, name: activeChild ? `${category.name} (${activeChild.name})` : category.name, childSlug: activeChild?.slug }}
          initialCategorySlug={joinCategory?.slug ?? ''}
          initialProfession={activeChild?.name}
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
