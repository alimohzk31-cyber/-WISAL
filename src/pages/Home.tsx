import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { usePageVisible } from '../hooks/usePageVisible';
import { Search, Compass, LayoutGrid, BriefcaseBusiness, Mic, MicOff, Loader2 } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { colorMapRedWhite } from '../data/categories';
import { useCategories } from '../hooks/useCategories';
import { useCategoryDirectory } from '../hooks/useCategoryDirectory';
import { useServices } from '../context/ServicesContext';
import { motion, AnimatePresence } from 'motion/react';

import { useSlider, getSlideDuration } from '../hooks/useSlider';

import { useLanguage } from '../context/LanguageContext';
import { useTheme, getPrimaryColor } from '../context/ThemeContext';
import { useImageFallback } from '../components/SafeImage';
import { BROWSE_SLIDER_FRAME_CLASS, BROWSE_SLIDER_IMAGE_CLASS, SLIDE_POSITION_CLASSES, SLIDE_TEXT_ALIGN } from '../data/slideStyles';
import SocialFeed from '../components/SocialFeed';
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
  const pageVisible = usePageVisible();
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
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const primaryColor = getPrimaryColor(theme);
  const { categories } = useCategories();
  const { publicServices, loading: servicesLoading, error: servicesError, refreshServices } = useServices();
  const { sections, bySection, searchServices } = useCategoryDirectory(categories, publicServices);
  const { ads: sliderAds, loading: sliderLoading, hasCachedData } = useSlider();
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

  // Build active slide items (expanding multi-image ads).
  // useMemo يمنع إعادة بناء المصفوفة في كل Render (مثلاً أثناء الكتابة في حقل
  // البحث) وبالتالي يمنع إعادة تنفيذ Preload وتحميل الصور من الشبكة بلا داعٍ.
  const activeSlides = useMemo(() => {
    // قاعدة الظهور العامة: is_active فقط.
    // السلايدر المفعل يبقى ظاهراً دائماً (اليوم/غداً/بعد أسبوع/بعد شهر) حتى يعطله
    // المدير بنفسه أو يحذفه — لا يوجد أي شرط زمني (display_date / start_time / end_time)
    // يمنع ظهوره. الأعمدة الزمنية تبقى في قاعدة البيانات وتظهر كمعلومات في لوحة الإدارة.
    return sliderAds
      .filter((ad) => ad.is_active !== false)
      .flatMap((ad) => {
        if (ad.images && ad.images.length > 0) {
          return ad.images.map((imgUrl) => ({
            url: imgUrl,
            title: ad.title,
            subtitle: ad.subtitle || '',
            button_text: ad.button_text || '',
            button_link: ad.button_link || '',
            duration_seconds: ad.duration_seconds,
            language: ad.language || 'ar',
            font_family: ad.font_family || 'Cairo',
            font_size: ad.font_size,
            text_color: ad.text_color || '#FFFFFF',
            button_color: ad.button_color || '#7C3AED',
            text_position: ad.text_position || 'bottom',
            text_align: ad.text_align || 'center'
          }));
        }
        return [{
          url: ad.url || '',
          title: ad.title,
          subtitle: ad.subtitle || '',
          button_text: ad.button_text || '',
          button_link: ad.button_link || '',
          duration_seconds: ad.duration_seconds,
          language: ad.language || 'ar',
          font_family: ad.font_family || 'Cairo',
          font_size: ad.font_size,
          text_color: ad.text_color || '#FFFFFF',
          button_color: ad.button_color || '#7C3AED',
          text_position: ad.text_position || 'bottom',
          text_align: ad.text_align || 'center'
        }];
      });
  }, [sliderAds]);

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

  // Slider navigation: next / prev + swipe support (touch devices)
  const nextSlide = useCallback(() => {
    if (activeSlides.length > 0) setCurrentImageIndex((i) => (i + 1) % activeSlides.length);
  }, [activeSlides.length]);
  const prevSlide = useCallback(() => {
    if (activeSlides.length > 0) setCurrentImageIndex((i) => (i - 1 + activeSlides.length) % activeSlides.length);
  }, [activeSlides.length]);

  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      // واجهة RTL: السحب لليمين = الشريحة السابقة، ولليسار = التالية
      if (dx > 0) prevSlide(); else nextSlide();
    }
    touchStartX.current = null;
  };

  // Preload the next slide image so transitions stay smooth (no quality change).
  // يعتمد على نص الرابط (primitive) وليس على المصفوفة كاملة، مع Set لحفظ الروابط
  // التي تَمت معالجتها مسبقاً؛ فيُتجنَّب التنفيذ مع كل re-render أو تغيير بسيط
  // في الصفحة، ولا يتكرر طلب الشبكة لنفس الرابط إطلاقاً (ولا إعادة محاولة بعد فشله).
  const nextSlideUrl = activeSlides.length > 1
    ? activeSlides[(currentImageIndex + 1) % activeSlides.length]?.url || ''
    : '';
  const preloadedUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!nextSlideUrl || !pageVisible) return;
    if (preloadedUrlsRef.current.has(nextSlideUrl)) return;
    preloadedUrlsRef.current.add(nextSlideUrl);
    const img = new Image();
    img.src = nextSlideUrl;
  }, [nextSlideUrl, pageVisible]);

  // Fallback للصورة الحالية في السلايدر: إذا فشل تحميلها تُستبدل بصورة بديلة آمنة
  // (data-URI) مرة واحدة فقط — حارس الـ fallback يمنع أي loop حتى لو فشل البديل.
  const currentSlide = activeSlides[currentImageIndex] ?? activeSlides[0];
  const currentSlideHasContent = Boolean(currentSlide?.title || currentSlide?.subtitle || currentSlide?.button_text);
  const { src: currentSlideSrc, onError: handleCurrentSlideError } = useImageFallback(currentSlide?.url || '');

  useEffect(() => {
    if (activeSlides.length === 0) {
      setCurrentImageIndex(0);
      return;
    }
    if (activeSlides.length === 1 || !pageVisible) return;
    // مدة العرض الحقيقية لكل شريحة تأتي من قاعدة البيانات (duration_seconds،
    // الافتراضي 5 ثوانٍ، بحدود 2-60). نستخدم setTimeout لكل شريحة على حدة
    // (وليس interval كل ثانية) ولا يوجد أي re-render وسيط.
    const current = activeSlides[currentImageIndex] ?? activeSlides[0];
    const durationMs = getSlideDuration(current) * 1000;
    const timer = setTimeout(() => {
      setCurrentImageIndex((prev) => (prev + 1) % activeSlides.length);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [activeSlides, currentImageIndex, pageVisible]);

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
    <div className="space-y-6 animate-in fade-in duration-500 relative">
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

      {/* Welcome Slider Section */}
      <div
        className={`${BROWSE_SLIDER_FRAME_CLASS} group`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {!sliderLoading && activeSlides.length > 0 ? (
          <>
            <AnimatePresence mode="wait">
              <motion.img
                key={`slide-${currentImageIndex}-${activeSlides[currentImageIndex]?.url}`}
                src={currentSlideSrc}
                alt={activeSlides[currentImageIndex]?.title || 'وصال | WISAL'}
                onError={handleCurrentSlideError}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className={BROWSE_SLIDER_IMAGE_CLASS}
                draggable={false}
                decoding="async"
                loading={currentImageIndex === 0 ? 'eager' : 'lazy'}
                fetchPriority={currentImageIndex === 0 ? 'high' : 'auto'}
              />
            </AnimatePresence>
            
            {/* النص Overlay فوق الصورة الكاملة؛ لا توجد لوحة أو خلفية منفصلة خلفه. */}
            {currentSlideHasContent && <div
              dir={activeSlides[currentImageIndex]?.language === 'en' ? 'ltr' : 'rtl'}
              className={`absolute inset-0 z-10 flex flex-col overflow-hidden px-4 pointer-events-none sm:px-6 ${SLIDE_POSITION_CLASSES[activeSlides[currentImageIndex]?.text_position || 'bottom']}`}
              style={{
                textAlign: SLIDE_TEXT_ALIGN[activeSlides[currentImageIndex]?.text_align || 'center'],
                fontFamily: `'${activeSlides[currentImageIndex]?.font_family || 'Cairo'}', Cairo, sans-serif`,
              }}
            >
                {/* العنوان (يظهر فقط عند إدخاله من إعدادات السلايدر) */}
                {activeSlides[currentImageIndex]?.title ? (
                  <motion.h1
                    key={`title-${currentImageIndex}`}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="mb-1.5 w-full text-2xl font-bold leading-tight drop-shadow-sm md:mb-2 md:text-5xl"
                    style={{
                      color: activeSlides[currentImageIndex]?.text_color || '#FFFFFF',
                      fontSize: activeSlides[currentImageIndex]?.font_size
                        ? `min(${activeSlides[currentImageIndex].font_size}px, 7vw)`
                        : undefined
                    }}
                  >
                    {activeSlides[currentImageIndex].title}
                  </motion.h1>
                ) : null}
                {/* العنوان الفرعي (يظهر فقط عند إدخاله من إعدادات السلايدر) */}
                {activeSlides[currentImageIndex]?.subtitle ? (
                  <motion.p
                    key={`subtitle-${currentImageIndex}`}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="w-full max-w-2xl text-sm font-bold leading-relaxed drop-shadow-sm md:text-xl"
                    style={{ color: activeSlides[currentImageIndex]?.text_color || '#FFFFFF' }}
                  >
                    {activeSlides[currentImageIndex].subtitle}
                  </motion.p>
                ) : null}
                {/* زر CTA (يظهر فقط عند إدخال نص الزر من إعدادات السلايدر) */}
                {activeSlides[currentImageIndex]?.button_text ? (
                  <motion.a
                    key={`cta-${currentImageIndex}`}
                    href={activeSlides[currentImageIndex].button_link || '#'}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="pointer-events-auto mt-2.5 inline-block rounded-xl px-5 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.03] hover:brightness-110 active:scale-95 md:mt-3 md:px-6 md:py-2.5 md:text-base"
                    style={{ backgroundColor: activeSlides[currentImageIndex]?.button_color || '#7C3AED' }}
                  >
                    {activeSlides[currentImageIndex].button_text}
                  </motion.a>
                ) : null}
            </div>}

            {/* Slider Indicators (clickable) - تظهر فقط مع أكثر من شريحة */}
            {activeSlides.length > 1 && (
              <div className="absolute bottom-3 md:bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20 px-4">
                {activeSlides.map((_, idx) => (
                  <button 
                    key={`slider-indicator-${idx}`} 
                    onClick={() => setCurrentImageIndex(idx)}
                    aria-label={`الشريحة ${idx + 1}`}
                    className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentImageIndex ? 'w-6' : 'w-1.5 bg-white/60 hover:bg-white/90'}`}
                    style={{ backgroundColor: idx === currentImageIndex ? primaryColor : undefined }}
                  />
                ))}
              </div>
            )}
          </>
        ) : !sliderLoading && activeSlides.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[var(--bg-secondary)]">
            <h1 className="text-3xl md:text-5xl font-bold mb-4 z-10 text-[var(--text-primary)]">
              {t('smart_guide')} <span style={{ color: primaryColor }}>{t('services')}</span>
            </h1>
            <p className="text-lg max-w-md font-bold z-10 text-[var(--text-secondary)]">
              دليلك الشامل لجميع الخدمات المحلية المعتمدة
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 animate-pulse bg-[var(--bg-secondary)]" role="status" aria-label="جارٍ تحميل السلايدر">
            <div className="absolute inset-x-6 bottom-8 h-5 rounded-full bg-[var(--surface-elevated)]/70" />
            <div className="absolute inset-x-16 bottom-16 h-8 rounded-full bg-[var(--surface-elevated)]/70" />
          </div>
        )}
      </div>

      {/* Primary navigation: three destinations below the slider — التصفح | الخدمات | البحث عن وظيفة */}
      <nav className="relative z-10 mx-auto -mt-4 flex w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 shadow-[var(--shadow-lg)]" aria-label="التنقل الرئيسي">
        <button
          type="button"
          onClick={() => setActiveView('browse')}
          aria-pressed={activeView === 'browse'}
          className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-xl px-1.5 py-3 text-[11px] font-bold transition-colors sm:gap-2 sm:px-4 sm:text-sm ${activeView === 'browse' ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]'}`}
        >
          <Compass className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
          التصفح
        </button>
        <button
          type="button"
          onClick={() => setActiveView('services')}
          aria-pressed={activeView === 'services'}
          className={`flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-xl px-1.5 py-3 text-[11px] font-bold transition-colors sm:gap-2 sm:px-4 sm:text-sm ${activeView === 'services' ? 'bg-[var(--accent-primary)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]'}`}
        >
          <LayoutGrid className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
          الخدمات
        </button>
        {/* يفتح صفحة الوظائف الحالية نفسها (نفس المسار /jobs) بنفس أيقونة الحقيبة */}
        <Link
          to="/jobs"
          aria-label="البحث عن وظيفة"
          className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-xl px-1.5 py-3 text-[11px] font-bold text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)] sm:gap-2 sm:px-4 sm:text-sm"
        >
          <BriefcaseBusiness className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
          البحث عن وظيفة
        </Link>
      </nav>

      {activeView === 'browse' ? <SocialFeed onAddService={openAddService} /> : <>

      {/* Search Bar */}
      <section className="relative max-w-2xl mx-auto space-y-3 z-10" aria-label="بحث الأقسام وإحصائياتها">
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pt-4">
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
              className={`group relative border rounded-2xl p-6 flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:-translate-y-1 z-10 bg-[var(--card)] border-[var(--border)] hover:shadow-[var(--shadow-lg)]`}
            >
              {/* Icon frame: white background + red border + red icon (no neon / no glow) */}
              <div className="w-14 h-14 rounded-full bg-white border-2 border-[#D90429] shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                {Icon && typeof Icon !== 'string' && <Icon className={`w-7 h-7 ${colors.text}`} />}
              </div>
              <div className="text-center">
                <span className="font-bold block text-[var(--text-primary)]">{cat.name}</span>
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
