import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Search, Mic, MicOff, Loader2 } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { colorMapRedWhite } from '../data/categories';
import { useCategories } from '../hooks/useCategories';
import { useCategoryDirectory } from '../hooks/useCategoryDirectory';
import { useServices } from '../context/ServicesContext';

import { useLanguage } from '../context/LanguageContext';
import { useTheme, getPrimaryColor } from '../context/ThemeContext';
import SocialFeed from '../components/SocialFeed';
import ContentSlider from '../components/ContentSlider';
import DirectoryNav from '../components/DirectoryNav';
import { buildServiceContentSlides, DEMO_SERVICE_SLIDES, SLIDER_DEMO_MODE } from '../lib/contentSlides';
const AddServiceModal = lazy(() => import('../components/AddServiceModal'));
import ErrorState from '../components/ui/ErrorState';
import { buildDirectorySearchIndex, searchDirectory, getDirectDirectoryMatch } from '../lib/directorySearch';
import { categoryUrl, directoryEntryState, getHomeView, shouldResetHomeScrollOnLoad } from '../lib/directoryNavigation';

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = getHomeView(searchParams.toString());
  const setActiveView = (view: 'browse' | 'services') => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    next.set('view', view);
    next.delete('tool');
    return next;
  }, { replace: true });
  const [showAddService, setShowAddService] = useState(false);
  const urlQuery = searchParams.get('q') ?? '';
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const settledQuery = useDebouncedValue(searchQuery);
  const queryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { setSearchQuery(urlQuery); }, [urlQuery]);
  useEffect(() => {
    if (searchQuery === urlQuery) return;
    queryTimer.current = setTimeout(() => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (searchQuery) next.set('q', searchQuery); else next.delete('q');
    return next;
    }, { replace: true }), 180);
    return () => clearTimeout(queryTimer.current);
  }, [searchQuery, urlQuery, setSearchParams]);
  const openAddService = useCallback(() => setShowAddService(true), []);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const primaryColor = getPrimaryColor(theme);
  const { categories } = useCategories();
  const { publicServices, loading: servicesLoading, error: servicesError, refreshServices } = useServices();
  const { sections, bySection, searchServices } = useCategoryDirectory(categories, publicServices);
  const { t } = useLanguage();
  const resetScrollAfterRefresh = useRef(
    typeof performance !== 'undefined' && shouldResetHomeScrollOnLoad(
      location.pathname,
      (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type,
    )
  );

  // Refresh على واجهتي التصفح والخدمات الرئيسيتين يبدأ من الأعلى فقط.
  // هذا المكوّن لا يُركّب داخل /category، لذلك لا يغيّر تمرير الأقسام.
  useLayoutEffect(() => {
    if (!resetScrollAfterRefresh.current) return;
    resetScrollAfterRefresh.current = false;
    sessionStorage.removeItem('homeScrollPos:browse');
    sessionStorage.removeItem('homeScrollPos:services');
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  // The main menu reuses the existing services search field for both search
  // and filtering; no second search or filter system is created.
  const tool = searchParams.get('tool');
  useEffect(() => {
    if (tool !== 'search') return;

    const frame = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [tool]);

  const contentSlides = useMemo(() => SLIDER_DEMO_MODE ? DEMO_SERVICE_SLIDES : buildServiceContentSlides(publicServices, categories), [publicServices, categories]);

  // Scroll Restoration — معالج مُهذَّب: القيمة تُحفظ في متغير خلال التمرير
  // (rAF مرة واحدة لكل إطار كحد أقصى) والكتابة لـ sessionStorage تحدث مرة واحدة
  // عند مغادرة الصفحة فقط. كان يكتب sessionStorage عند كل حدث تمرير (عشرات
  // المرات في الثانية) وهذا يسبب تقطيعاً أثناء السكرول على الهاتف.
  useEffect(() => {
    const scrollKey = `homeScrollPos:${activeView}`;
    const savedPosition = sessionStorage.getItem(scrollKey);
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;
    if (savedPosition) {
      // Small delay to ensure content is rendered
      restoreTimer = setTimeout(() => {
        window.scrollTo({
          top: parseInt(savedPosition),
          behavior: 'instant'
        });
        sessionStorage.removeItem(scrollKey);
      }, 100);
    }

    let latestY = 0;
    let ticking = false;
    const handleScroll = () => {
      latestY = window.scrollY;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => { ticking = false; });
      }
    };

    // Only save if we are not at the very top (to avoid saving 0 when navigating away)
    const persistPosition = () => {
      if (latestY > 0) {
        sessionStorage.setItem(scrollKey, latestY.toString());
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pagehide', persistPosition);
    return () => {
      clearTimeout(restoreTimer);
      persistPosition();
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pagehide', persistPosition);
    };
  }, [activeView]);

  // تصفية الأقسام — مُخزَّنة لتجنب إعادة الحساب في كل render (البحث يعيد الرسم
  // عند كل حرف، والتصفية تُحسب فقط عند تغير القائمة أو نص البحث)
  const searchIndex = useMemo(() => buildDirectorySearchIndex(sections, searchServices), [sections, searchServices]);
  const searchResults = useMemo(() => searchDirectory(searchIndex, settledQuery), [searchIndex, settledQuery]);
  const filteredCategories = useMemo(() => searchQuery.trim()
    ? sections.filter(section => searchResults.some(result => result.section.slug === section.slug))
    : sections, [sections, searchResults, searchQuery]);
  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const direct = getDirectDirectoryMatch(searchDirectory(searchIndex, searchQuery));
    if (direct) {
      clearTimeout(queryTimer.current);
      navigate(direct.url, { state: directoryEntryState(location) });
    }
  };

  const toggleVoiceSearch = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError('البحث الصوتي غير مدعوم في هذا المتصفح. يمكنك استخدام البحث النصي.');
      return;
    }
    const recognition = new Recognition() as SpeechRecognitionInstance;
    recognition.lang = 'ar-IQ';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) setSearchQuery(transcript);
    };
    recognition.onerror = (event: any) => {
      setVoiceError(event.error === 'not-allowed' ? 'لم يتم السماح باستخدام الميكروفون.' : 'تعذر التعرف على الصوت. حاول مرة أخرى.');
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setVoiceError('');
    setIsListening(true);
    try { recognition.start(); } catch { setIsListening(false); }
  }, [isListening, setSearchQuery]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  return (
    <div className="relative w-full min-w-0 max-w-full space-y-6 animate-in fade-in duration-500">
      {/* Ambient Background Lights — ثابتة بدون حركة JS (كانت تسبب لاقاً حاداً
          على الهاتف: 3 عناصر بـ blur ضخم تُعاد رسمها كل إطار بلا نهاية). الشكل
          البصري (توهج محيطي) محفوظ لكن بتكلفة رسم واحدة فقط. */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute top-[20%] -left-[10%] w-[40%] h-[40%] rounded-full blur-[120px] bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)]"
        />
        <div
          className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full blur-[120px] bg-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)]"
        />
        <div
          className="absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full blur-[100px] bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)]"
        />
      </div>

      <ContentSlider slides={contentSlides} loading={servicesLoading} label="الخدمات المعتمدة" testId="services-slider" imageFit="contain" />

      {/* Primary navigation: three destinations below the slider — التصفح | الخدمات | البحث عن وظيفة */}
      <DirectoryNav activeView={activeView} onHomeViewChange={setActiveView} />

      {activeView === 'browse' ? <SocialFeed onAddService={openAddService} /> : <>

      {/* Search Bar */}
      <section className="relative z-10 mx-auto w-full min-w-0 max-w-2xl space-y-3" aria-label="بحث الأقسام وإحصائياتها">
      <form onSubmit={submitSearch} role="search" className="relative group">
        {/* Search Bar Glow */}
        <div className="absolute -inset-1 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 -z-10" style={{ backgroundColor: primaryColor }} />
        
        <button type="submit" aria-label="بحث وفتح القسم المطابق" className="absolute inset-y-2 right-2 flex w-10 items-center justify-center rounded-xl hover:bg-[var(--accent-soft)]">
          <Search className="w-5 h-5 transition-colors" style={{ color: searchQuery ? `var(--accent-primary)` : `var(--text-muted)` }} />
        </button>
        <input
          ref={searchInputRef}
          type="text"
          aria-label="ابحث عن قسم أو تخصص"
          aria-describedby="directory-search-help"
          autoComplete="off"
          enterKeyHint="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`w-full border rounded-2xl pl-14 pr-12 py-4 text-lg focus:outline-none transition-all bg-[var(--input-bg)] border-[var(--input-border)] text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] shadow-[var(--shadow)]`}
          style={{ 
            borderColor: searchQuery ? primaryColor : undefined,
            boxShadow: searchQuery ? `0 0 20px ${primaryColor}30` : undefined
          }}
          placeholder={t('search_placeholder')}
        />
        <button type="button" onClick={toggleVoiceSearch} aria-label={isListening ? 'إيقاف البحث الصوتي' : 'بدء البحث الصوتي'} title={isListening ? 'إيقاف الاستماع' : 'بحث صوتي'} className={`absolute inset-y-2 left-2 flex w-11 items-center justify-center rounded-xl transition-colors ${isListening ? 'bg-red-500/10 text-red-500' : 'text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)]'}`}>
          {isListening ? <MicOff className="h-5 w-5 animate-pulse" /> : <Mic className="h-5 w-5" />}
        </button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
        <p aria-live="polite" aria-atomic="true" className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-bold">
          الأقسام: {sections.length.toLocaleString('ar-IQ')} <span className="mx-2" aria-hidden="true">|</span>
          {servicesLoading && publicServices.length === 0 && !servicesError
            ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> جارٍ تحميل الخدمات…</span>
            : <>الخدمات: {publicServices.length.toLocaleString('ar-IQ')}</>}
        </p>
        <p id="directory-search-help">ابحث عن قسم أو تخصص، ثم اضغط بحث.</p>
      </div>
      {servicesError && publicServices.length === 0 && (
        <ErrorState onRetry={() => { void refreshServices(); }} />
      )}
      {searchQuery.trim() && (searchResults.length > 0 ? (
        <ul className="max-h-64 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2" aria-label="اقتراحات الأقسام">
          {searchResults.slice(0, 8).map(result => (
            <li key={result.url}>
              <Link to={result.url} state={directoryEntryState(location)} className="block rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--accent-soft)] focus-visible:bg-[var(--accent-soft)]">
                {result.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : <p role="status" className="py-3 text-sm text-[var(--text-muted)]">لم يتم العثور على قسم مطابق</p>)}
      </section>
      {voiceError && <p className="mx-auto mt-2 max-w-2xl text-sm font-bold text-red-500">{voiceError}</p>}

      {/* Categories Grid */}
      <div className="grid min-w-0 grid-cols-2 gap-3 pt-4 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filteredCategories.map((cat) => {
          // Each main field uses its directory icon, including React forward refs.
          const Icon = cat.icon;
          const colors = colorMapRedWhite[cat.color] || colorMapRedWhite['green'];
          const categoryServices = bySection.get(cat.slug) ?? [];
          
          return (
            <Link
              key={cat.slug}
              to={categoryUrl(cat.slug)}
              state={directoryEntryState(location)}
              className={`group relative z-10 flex min-w-0 flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] sm:gap-4 sm:p-6`}
            >
              {/* Icon frame: white background + red border + red icon (no neon / no glow) */}
              <div className="w-14 h-14 rounded-full bg-white border-2 border-[#D90429] shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                {Icon && typeof Icon !== 'string' && <Icon className={`w-7 h-7 ${colors.text}`} />}
              </div>
              <div className="text-center">
                <span className="block break-words font-bold text-[var(--text-primary)]">{cat.name}</span>
                {cat.children.length > 0 && <span className="text-xs mt-1 block text-[var(--text-muted)]">{cat.children.length} أقسام فرعية</span>}
                <span className="text-xs mt-1 block font-medium text-[var(--text-secondary)]">{categoryServices.length} {t('services_count')}</span>
              </div>
            </Link>
          );
        })}
        
        {filteredCategories.length === 0 && !searchQuery.trim() && (
          <div className="col-span-full text-center py-12 font-medium text-[var(--text-muted)]">
            {t('no_sections_found')}
          </div>
        )}
      </div>
      </>}

      {showAddService && (
        <Suspense fallback={null}>
        <AddServiceModal onClose={() => setShowAddService(false)} />
        </Suspense>
      )}
    </div>
  );
}
