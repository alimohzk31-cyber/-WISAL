import {lazy, StrictMode, Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Loading App inside the boundary also exposes rejected module imports.
// A static App import would fail before React can mount any error UI.
const App = lazy(() => import('./App.tsx'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary scope="app">
      <Suspense fallback={<p role="status" style={{ padding: '3rem', textAlign: 'center', color: '#312e81', background: '#fff' }}>جارٍ تشغيل وصال…</p>}>
        <App />
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
);
