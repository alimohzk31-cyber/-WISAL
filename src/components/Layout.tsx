import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { Heart } from 'lucide-react';
import wisalHeaderLogo from '../assets/wisal-header-logo.png';
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
const AdminLoginModal = lazy(() => import('./AdminLoginModal'));
import { useStats } from '../hooks/useStats';
import { useLanguage } from '../context/LanguageContext';
import { useTheme, getPrimaryColor } from '../context/ThemeContext';
import HeaderClock from './HeaderClock';
import MainMenuController from './MainMenuController';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { theme } = useTheme();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);
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
  const { beginAdminPinAttempt } = useAuth();
  const adminClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleAdminClick = () => {
    if (adminClickTimerRef.current) {
      clearTimeout(adminClickTimerRef.current);
    }

    const newCount = adminClickCount + 1;
    if (newCount === 5) {
      beginAdminPinAttempt();
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
    <div className={`min-h-screen w-full min-w-0 max-w-full font-sans transition-colors duration-300 ${location.pathname === '/admin' ? 'wisal-admin-route' : ''}`} dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full min-w-0 max-w-full backdrop-blur-md border-b bg-[var(--header-bg)] border-[var(--border-color)]">
        <div className="relative mx-auto flex h-20 w-full min-w-0 max-w-7xl items-center justify-between px-3 sm:px-4">
          
          {/* Right: desktop-only admin access */}
          <div className="flex min-w-0 items-center gap-2">
            {isDesktop ? (
              // سطح المكتب: صورة وصال — 5 ضغطات متتالية تفتح AdminLoginModal (نفس المنطق الحالي)
              <button
                type="button"
                onClick={handleAdminClick}
                className="flex aspect-square h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl"
              >
                <img
                  src={wisalHeaderLogo}
                  width={36} height={36} style={{ aspectRatio: '1 / 1' }}
                  alt=""
                  className="h-full w-full rounded-xl object-contain"
                  draggable={false}
                />
              </button>
            ) : (
              /* الهاتف والأجهزة الصغيرة: شعار شفاف نظيف منفصل عن أي خلفية — بلا أي حدث أو منطق إدارة */
              <button
                type="button"
                onClick={handleAdminClick}
                className="flex aspect-square h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl"
              >
                <img
                src={wisalHeaderLogo}
                width={36} height={36} style={{ aspectRatio: '1 / 1' }}
                alt=""
                className="h-full w-full rounded-xl object-contain"
                draggable={false}
                />
              </button>
            )}


          </div>

          {/* Center: App Logo */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
            <Link to="/" aria-label={t('app_name')}>
              <HeaderClock />
            </Link>
          </div>

          <MainMenuController />
        </div>
      </header>



      {/* Main Content */}
      <main className="max-w-7xl px-3 py-8 sm:px-4 mx-auto min-h-[calc(100vh-200px)] w-full min-w-0 pb-24">
        {/* Keep one route outlet in document flow; exiting outlets must not
            reserve space above the newly committed page. */}
        <div key={location.pathname} className="w-full min-w-0 max-w-full">
          <Outlet context={{ primaryColor, theme }} />
        </div>
      </main>

      {/* Footer */}
      <footer className={`mt-auto border-t py-12 bg-[var(--bg-secondary)] border-[var(--border)]`}>
        <div className="mx-auto w-full min-w-0 max-w-7xl px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="text-sm font-bold text-[var(--text-muted)]">{t('app_name')}</div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-8 gap-y-3">
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

            <div className="flex min-w-0 flex-wrap items-center justify-center gap-2 text-center text-sm text-[var(--text-muted)] font-medium">
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

      <Suspense fallback={null}>
        {showAdminLogin && (
          <AdminLoginModal
            onClose={() => setShowAdminLogin(false)}
            onSuccess={() => {
              setShowAdminLogin(false);
              navigate('/admin');
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
