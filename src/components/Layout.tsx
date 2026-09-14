import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Bookmark, Info, Heart, MessageSquareWarning, Menu, Search, Palette, Bell, PackageCheck } from 'lucide-react';
import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
const AdminLoginModal = lazy(() => import('./AdminLoginModal'));
const SuggestionsFeedModal = lazy(() => import('./SuggestionsFeedModal'));
import NotificationsPopup from './NotificationsPopup';
const SmartSearchModal = lazy(() => import('./SmartSearchModal'));
const AppVersionModal = lazy(() => import('./AppVersionModal'));
import { APP_VERSION, checkForUpdate } from '../lib/appVersion';
import { useNotifications } from '../hooks/useNotifications';
import { useStats } from '../hooks/useStats';
import { useLanguage } from '../context/LanguageContext';
import { useTheme, getPrimaryColor } from '../context/ThemeContext';
import ThemeToggle from './ThemeToggle';
import HeaderClock from './HeaderClock';
import { motion, AnimatePresence } from 'motion/react';

export default function Layout() {
  const { theme } = useTheme();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifications = useNotifications();
  const closeNotifications = useCallback(() => setShowNotifications(false), []);
  const [showProjectBrief, setShowProjectBrief] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [showSmartSearch, setShowSmartSearch] = useState(false);
  const [showAppVersion, setShowAppVersion] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);


  // فحص Responsive موثوق (window.matchMedia): منطق الإدارة (5 ضغطات) يعمل على
  // سطح المكتب فقط — نفس breakpoint sm = 640px المستخدم في المشروع (Tailwind).
  const [isDesktop, setIsDesktop] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // فحص توفر تحديث مرة واحدة عند تحميل التطبيق (يُربط لاحقًا بمصدر خارجي
  // مثل API أو ملف JSON عبر checkForUpdate في src/lib/appVersion.ts).
  useEffect(() => {
    let cancelled = false;
    void checkForUpdate().then(result => {
      if (!cancelled) setHasUpdate(result.hasUpdate);
    });
    return () => { cancelled = true; };
  }, []);
  const [colorsOpen, setColorsOpen] = useState(false);
  const briefRef = useRef<HTMLDivElement>(null);
  const mainMenuRef = useRef<HTMLDivElement>(null);
  const adminClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleAdminClick = () => {
    // الهاتف والأجهزة الصغيرة: لا يوجد أي منطق إدارة مربوط بالصورة مطلقًا —
    // فحص matchMedia وقت الضغط (وليس CSS فقط) لضمان التعطيل الكامل.
    if (!isDesktop) return;

    if (adminClickTimerRef.current) {
      clearTimeout(adminClickTimerRef.current);
    }

    const newCount = adminClickCount + 1;
    if (newCount === 5) {
      setShowAdminLogin(true);
      setAdminClickCount(0);
    } else {
      setAdminClickCount(newCount);
      // Five taps must be consecutive; a pause starts a fresh sequence.
      adminClickTimerRef.current = setTimeout(() => {
        setAdminClickCount(0);
        adminClickTimerRef.current = null;
      }, 2000);
    }
  };

  useEffect(() => () => {
    if (adminClickTimerRef.current) {
      clearTimeout(adminClickTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (briefRef.current && !briefRef.current.contains(event.target as Node)) {
        setShowProjectBrief(false);
      }
      if (mainMenuRef.current && !mainMenuRef.current.contains(event.target as Node)) {
        setShowMainMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const { t, isRTL } = useLanguage();
  const primaryColor = getPrimaryColor(theme);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { incrementVisits } = useStats(false);
  const lastVisitPath = useRef<string | null>(null);

  useEffect(() => {
    if (lastVisitPath.current === location.pathname) return;
    lastVisitPath.current = location.pathname;
    incrementVisits();
  }, [location.pathname]);

  return (
    <div className="min-h-screen font-sans transition-colors duration-300" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md border-b bg-[var(--header-bg)] border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between relative">
          
          {/* Right: desktop-only admin access */}
          <div className="flex items-center gap-2">
            {isDesktop ? (
              // سطح المكتب: صورة وصال — 5 ضغطات متتالية تفتح AdminLoginModal (نفس المنطق الحالي)
              <button
                type="button"
                onClick={handleAdminClick}
                className="flex items-center px-3 py-2 rounded-xl transition-colors hover:bg-[var(--accent-soft)]"
                title={t('admin_panel')}
                aria-label={t('admin_panel')}
              >
                <img
                  src={`${(import.meta as any).env.BASE_URL}favicon.png`}
                  alt={t('app_name')}
                  className="w-7 h-7 rounded-lg object-cover"
                  style={{ filter: `drop-shadow(0 0 5px ${primaryColor}40)` }}
                  draggable={false}
                />
              </button>
            ) : (
              /* الهاتف والأجهزة الصغيرة: شعار شفاف نظيف منفصل عن أي خلفية — بلا أي حدث أو منطق إدارة */
              <img
                src={`${(import.meta as any).env.BASE_URL}wisal-header-logo.png`}
                alt={t('app_name')}
                className="h-14 w-auto object-contain shrink-0"
                draggable={false}
              />
            )}

            <div className="relative" ref={briefRef}>
              <AnimatePresence>
                {showProjectBrief && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-2 w-72 p-4 rounded-2xl border shadow-[var(--shadow-lg)] z-50 bg-[var(--surface-elevated)] border-[var(--border)]"
                  >
                    <h3 className="font-bold mb-2 flex items-center gap-2">
                      <Info className="w-4 h-4" style={{ color: primaryColor }} />
                      {t('project_brief')}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      {t('project_description')}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Center: App Logo */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <Link to="/" aria-label={t('app_name')}>
              <HeaderClock />
            </Link>
          </div>

          {/* Left: ☰ Main Menu — 5 items, Admin outside */}
          <div className="relative" ref={mainMenuRef}>
            <button
              type="button"
              onClick={() => setShowMainMenu(value => !value)}
              aria-label="القائمة الرئيسية"
              aria-expanded={showMainMenu}
              aria-controls="main-menu"
              className="p-2 rounded-xl transition-colors border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)]"
            >
              <Menu className="w-6 h-6" />
            </button>

            <AnimatePresence>
              {showMainMenu && (
                <motion.div
                  id="main-menu"
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  className="absolute left-0 mt-2 w-60 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2 shadow-[var(--shadow-lg)] z-50"
                >
                  <button
                    type="button"
                    onClick={() => { notifications.refresh(); setShowNotifications(true); setShowMainMenu(false); }}
                    aria-haspopup="dialog"
                    aria-label={notifications.unreadCount > 0 ? `الإشعارات، ${notifications.unreadCount} غير مقروءة` : 'الإشعارات'}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-blue-500/10"
                  >
                    <span className="relative shrink-0">
                      <Bell className="h-5 w-5 text-blue-500" strokeWidth={1.8} aria-hidden="true" />
                      {notifications.unreadCount > 0 && (
                        <span aria-hidden="true" className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] leading-none font-bold text-white ring-2 ring-[var(--surface-elevated)]">
                          {notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}
                        </span>
                      )}
                    </span>
                    الإشعارات
                  </button>
                  {/* Suggestions use the existing contact_messages source. */}
                  <button
                    type="button"
                    onClick={() => { setShowSuggestions(true); setShowMainMenu(false); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-teal-500/10"
                  >
                    <MessageSquareWarning className="h-5 w-5 text-teal-500" />
                    الاقتراحات
                  </button>
                  <Link
                    to="/saved"
                    onClick={() => setShowMainMenu(false)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-amber-500/10"
                  >
                    <Bookmark className="h-5 w-5 text-amber-500" />
                    الخدمات المحفوظة
                  </Link>
                  {/* 3. 🔎 البحث الذكي — نافذة عائمة صغيرة داخل نفس الصفحة */}
                  <button
                    type="button"
                    onClick={() => { setShowSmartSearch(true); setShowMainMenu(false); }}
                    aria-haspopup="dialog"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-violet-500/10"
                  >
                    <Search className="h-5 w-5 text-violet-500" />
                    البحث الذكي
                  </button>
                  {/* 5. 📦 الإصدار — نافذة صغيرة تعرض رقم الإصدار وحالة التحديث */}
                  <button
                    type="button"
                    onClick={() => { setShowAppVersion(true); setShowMainMenu(false); }}
                    aria-haspopup="dialog"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-emerald-500/10"
                  >
                    <span className="relative shrink-0">
                      <PackageCheck className="h-5 w-5 text-emerald-500" strokeWidth={1.8} aria-hidden="true" />
                      {hasUpdate && (
                        <span aria-hidden="true" className="absolute -top-1.5 -left-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 ring-2 ring-[var(--surface-elevated)]">
                          <span className="h-1 w-1 rounded-full bg-white" />
                        </span>
                      )}
                    </span>
                    الإصدار
                    <span className="mr-auto text-[10px] font-bold text-[var(--text-muted)]" dir="ltr">{APP_VERSION}</span>
                  </button>
                  {/* 4. 🎨 قائمة الألوان */}
                  <button
                    type="button"
                    onClick={() => { setColorsOpen(true); setShowMainMenu(false); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--accent-soft)]"
                  >
                    <Palette className="h-5 w-5" style={{ color: 'var(--accent-primary)' }} />
                    قائمة الألوان
                  </button>
                  {/* 6. ℹ️ نبذة عن المشروع — reuses the existing project brief popup (no duplicate system) */}
                  <button
                    type="button"
                    onClick={() => { setShowProjectBrief(true); setShowMainMenu(false); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right text-sm font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--accent-soft)]"
                  >
                    <Info className="h-5 w-5" style={{ color: primaryColor }} />
                    نبذة عن المشروع
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>



      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 pb-24 min-h-[calc(100vh-200px)]">
        {/* انتقال فوري وسلس بين الصفحات:
            - كان `mode="wait"` يؤخر تركيب الصفحة الجديدة حتى اكتمال حركة خروج
              الصفحة القديمة كاملة (إحساس بأن التطبيق «معلّق» عند كل تنقّل).
            - الآن تُركّب الصفحة الجديدة فوراً (الوضع الافتراضي sync)، وتتحرك
              القديمة للخارج بجانبها، بمدة أقصر (0.18s بدل 0.3s).
            - Suspense يظهر فقط عند أول جلب chunk فعلية، وليس عند كل تنقّل. */}
        <AnimatePresence>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Outlet context={{ primaryColor, theme }} />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className={`mt-auto border-t py-12 bg-[var(--bg-secondary)] border-[var(--border)]`}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="text-sm font-bold text-[var(--text-muted)]">{t('app_name')}</div>
            </div>

            <div className="flex items-center gap-8">
              <Link 
                to="/about" 
                className="text-sm font-bold hover:text-[var(--text-primary)] transition-colors"
                style={{ color: location.pathname === '/about' ? primaryColor : undefined }}
              >
                {t('about_us')}
              </Link>
              <Link to="/" className="text-sm font-bold hover:text-[var(--text-primary)] transition-colors">
                {t('main_dashboard')}
              </Link>
            </div>

            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] font-medium">
              <span>صنع بـ</span>
              <Heart className="w-4 h-4 text-red-500 fill-current" />
              <span>لخدمة المجتمع</span>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-current opacity-10 text-center text-xs font-bold text-[var(--text-muted)]">
            © {new Date().getFullYear()} {t('app_name')}. جميع الحقوق محفوظة.
          </div>
        </div>
      </footer>

      {/* Popups — triggered from ☰ menu (reusing existing components) */}
      <Suspense fallback={null}>

      {showSuggestions && <SuggestionsFeedModal onClose={() => setShowSuggestions(false)} />}
      {showNotifications && <NotificationsPopup {...notifications} onClose={closeNotifications} />}

      {/* قائمة الألوان — reused ThemeToggle in controlled mode */}
      {colorsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <ThemeToggle open={colorsOpen} onOpenChange={setColorsOpen} hideTrigger />
        </div>
      )}

      {showAdminLogin && (
        <AdminLoginModal
          onClose={() => setShowAdminLogin(false)}
          onSuccess={() => {
            setShowAdminLogin(false);
            navigate('/admin');
          }}
        />
      )}

      {/* نافذة البحث الذكي العائمة (صغيرة، لا تغطي الشاشة) */}
      {showSmartSearch && <SmartSearchModal open onClose={() => setShowSmartSearch(false)} />}
      {/* نافذة إصدار التطبيق */}
      {showAppVersion && <AppVersionModal
        open={showAppVersion}
        onClose={() => setShowAppVersion(false)}
        hasUpdate={hasUpdate}
        onUpdateAccepted={() => setHasUpdate(false)}
      />}
      </Suspense>
    </div>
  );
}
