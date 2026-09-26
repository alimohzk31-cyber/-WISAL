/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Network } from '@capacitor/network';
import Layout from './components/Layout';
import ToastProvider from './components/ToastProvider';
import AdminRoute from './components/AdminRoute';
import { lazy, Suspense } from 'react';
// Code splitting: لوحة الإدارة و«من نحن» لا تُحمَّلان في الحزمة الرئيسية —
// يُجلب كودها فقط عند فتح مسارها فعليًا، فيبقى حجم حزمة الصفحة الرئيسية
// وقسم الخدمات أصغر وأسرع على الإنترنت الضعيف.
const Home = lazy(() => import('./pages/Home'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const ServicePage = lazy(() => import('./pages/ServicePage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const JobsPage = lazy(() => import('./pages/jobs/JobsPage'));
const JobDetailPage = lazy(() => import('./pages/jobs/JobDetailPage'));
const SavedServicesPage = lazy(() => import('./pages/SavedServicesPage'));

import { ServicesProvider } from './context/ServicesContext';
import { CategoriesProvider } from './hooks/useCategories';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { getHomeView } from './lib/directoryNavigation';
import {
  browserNetworkInformation, networkQualityStatus, notifyAppOnline,
  type AppNetworkStatus,
} from './lib/connectivity';
import ErrorBoundary from './components/ErrorBoundary';

function ConnectivityNotice() {
  const [status, setStatus] = useState<AppNetworkStatus>(() => networkQualityStatus());
  const statusRef = useRef(status);

  useEffect(() => {
    let active = true;
    let removeCapacitorListener: (() => Promise<void>) | undefined;
    let recoveringTimer: ReturnType<typeof setTimeout> | undefined;
    const applyStatus = (nextConnected: boolean) => {
      if (!active) return;
      const restored = statusRef.current === 'offline' && nextConnected;
      const nextStatus: AppNetworkStatus = restored ? 'recovering' : networkQualityStatus(nextConnected);
      statusRef.current = nextStatus;
      setStatus(nextStatus);
      if (restored) {
        notifyAppOnline();
        clearTimeout(recoveringTimer);
        recoveringTimer = setTimeout(() => {
          if (!active) return;
          const settled = networkQualityStatus();
          statusRef.current = settled;
          setStatus(settled);
        }, 1500);
      }
    };
    const handleOnline = () => applyStatus(true);
    const handleOffline = () => applyStatus(false);
    const handleQualityChange = () => {
      if (statusRef.current !== 'recovering') applyStatus(navigator.onLine);
    };
    const connection = browserNetworkInformation();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    connection?.addEventListener?.('change', handleQualityChange);
    void Network.getStatus().then(status => applyStatus(status.connected)).catch(() => undefined);
    void Network.addListener('networkStatusChange', status => applyStatus(status.connected))
      .then(handle => { removeCapacitorListener = () => handle.remove(); })
      .catch(() => undefined);

    return () => {
      active = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      connection?.removeEventListener?.('change', handleQualityChange);
      clearTimeout(recoveringTimer);
      void removeCapacitorListener?.();
    };
  }, []);

  if (status !== 'offline') return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-[400] bg-red-600 px-4 py-2 text-center text-sm font-bold text-white shadow-md">
      أنت غير متصل بالإنترنت
    </div>
  );
}

function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 py-8" role="status" aria-label="جارٍ التحميل">
      <div className="h-48 animate-pulse rounded-3xl bg-[var(--bg-secondary)]" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map(item => <div key={item} className="h-28 animate-pulse rounded-2xl bg-[var(--bg-secondary)]" />)}
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname, search, key } = useLocation();
  const previousPath = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useLayoutEffect(() => {
    const changedPage = previousPath.current !== pathname;
    previousPath.current = pathname;
    // Category entries and specialty query changes always start at the top,
    // including browser Back/Forward. Home typing does not move the viewport.
    if (!pathname.startsWith('/category/')) {
      if (!changedPage) return;
      if (pathname === '/' && sessionStorage.getItem(`homeScrollPos:${getHomeView(search)}`)) return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const frame = requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    return () => cancelAnimationFrame(frame);
  }, [pathname, search, key]);

  return null;
}

export default function App() {
  useEffect(() => {
    const loader = document.getElementById('loading-screen');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 180);
    }
  }, []);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <ServicesProvider>
          <CategoriesProvider>
            <AuthProvider>
              <ToastProvider>
              <ConnectivityNotice />
              <HashRouter>
                <ScrollToTop />
                <Routes>
                  <Route path="/" element={<Layout />}>
                    {/* Suspense: fallback خفيف بدل شاشة بيضاء أثناء جلب chunk الصفحة */}
                    {/* ErrorBoundary: خطأ في صفحة واحدة يعرض رسالة أنيقة بدل انهيار التطبيق */}
                    <Route index element={<Suspense fallback={<RouteFallback />}><ErrorBoundary><Home /></ErrorBoundary></Suspense>} />
                    <Route path="category/:id" element={<Suspense fallback={<RouteFallback />}><ErrorBoundary><CategoryPage /></ErrorBoundary></Suspense>} />
                    <Route path="service/:serviceId" element={<Suspense fallback={<RouteFallback />}><ErrorBoundary><ServicePage /></ErrorBoundary></Suspense>} />
                    <Route element={<AdminRoute />}>
                      <Route path="admin" element={<Suspense fallback={<RouteFallback />}><ErrorBoundary><AdminDashboard /></ErrorBoundary></Suspense>} />
                    </Route>
                    <Route path="about" element={<Suspense fallback={<RouteFallback />}><ErrorBoundary><AboutUs /></ErrorBoundary></Suspense>} />
                    <Route path="jobs" element={<Suspense fallback={<RouteFallback />}><ErrorBoundary><JobsPage /></ErrorBoundary></Suspense>} />
                    <Route path="jobs/:jobId" element={<Suspense fallback={<RouteFallback />}><ErrorBoundary><JobDetailPage /></ErrorBoundary></Suspense>} />
                    <Route path="saved" element={<Suspense fallback={<RouteFallback />}><ErrorBoundary><SavedServicesPage /></ErrorBoundary></Suspense>} />
                  </Route>
                </Routes>
              </HashRouter>
              </ToastProvider>
            </AuthProvider>
          </CategoriesProvider>
        </ServicesProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
