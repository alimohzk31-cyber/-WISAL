/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter, Routes, Route, useLocation, Link } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { browserStorage } from './lib/browserStorage';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Network } from '@capacitor/network';
import { WifiOff, RefreshCw } from 'lucide-react';
import Layout from './components/Layout';
import AdminRoute from './components/AdminRoute';
import { lazy, Suspense } from 'react';
// Code splitting: لوحة الإدارة و«من نحن» لا تُحمَّلان في الحزمة الرئيسية —
// يُجلب كودها فقط عند فتح مسارها فعليًا، فيبقى حجم حزمة الصفحة الرئيسية
// وقسم الخدمات أصغر وأسرع على الإنترنت الضعيف.
const Home = lazy(() => import('./pages/Home'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AboutUs = lazy(() => import('./pages/AboutUs'));

import { ServicesProvider } from './context/ServicesContext';
import { LanguageProvider } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { getHomeView } from './lib/directoryNavigation';

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="جارٍ التحميل">
      <div className="w-10 h-10 rounded-full border-4 border-[var(--accent-soft)] border-t-[var(--accent-primary)] animate-spin" />
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
      if (pathname === '/' && browserStorage.get(`homeScrollPos:${getHomeView(search)}`, true)) return;
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
      setTimeout(() => loader.remove(), 500);
    }
  }, []);

  return (
    <ErrorBoundary><ThemeProvider>
      <LanguageProvider>
        <ServicesProvider>
          <AuthProvider>
            <HashRouter>
              <ScrollToTop />
              <Routes>
                <Route path="/" element={<Layout />}>
                  {/* Suspense: fallback خفيف بدل شاشة بيضاء أثناء جلب chunk الصفحة */}
                  <Route index element={<Suspense fallback={<RouteFallback />}><Home /></Suspense>} />
                  <Route path="category/:id" element={<Suspense fallback={<RouteFallback />}><CategoryPage /></Suspense>} />
                  <Route element={<AdminRoute />}>
                    <Route path="admin" element={<Suspense fallback={<RouteFallback />}><AdminDashboard /></Suspense>} />
                  </Route>
                  <Route path="about" element={<Suspense fallback={<RouteFallback />}><AboutUs /></Suspense>} />
                  <Route path="*" element={<div className="text-center py-20 space-y-4"><p>الصفحة غير موجودة</p><Link to="/" className="underline">العودة للرئيسية</Link></div>} />
                </Route>
              </Routes>
            </HashRouter>
          </AuthProvider>
        </ServicesProvider>
      </LanguageProvider>
    </ThemeProvider></ErrorBoundary>
  );
}
