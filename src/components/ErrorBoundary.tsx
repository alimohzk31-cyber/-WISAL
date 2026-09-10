import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  scope?: 'app' | 'page';
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * ErrorBoundary — يعزل أخطاء الرسم (Rendering) داخل حدّ الصفحة.
 * خطأ في Component واحد يعرض رسالة أنيقة مع «إعادة المحاولة» بدل انهيار
 * التطبيق بالكامل (شاشة بيضاء).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : 'خطأ غير متوقع' };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[ErrorBoundary] خطأ في مكوّن:', error, info.componentStack);
  }

  private reset = () => {
    // React.lazy caches rejected imports; reloading is needed to retry startup.
    if (this.props.scope === 'app') window.location.reload();
    else this.setState({ hasError: false, message: '' });
  };

  private goHome = () => {
    window.location.hash = '#/';
    this.reset();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 py-20 text-center" role="alert" dir="rtl"
        style={{ color: 'var(--text-primary, #111827)', background: 'var(--surface, #fff)' }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center bg-red-500/10">
          <AlertTriangle className="w-10 h-10 text-red-500" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{this.props.scope === 'app' ? 'تعذر تشغيل وصال' : 'حدث خطأ في هذه الصفحة'}</h2>
        <p className="max-w-md break-words font-medium text-[var(--text-muted)]">{this.state.message}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={this.reset}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 font-bold transition-transform hover:scale-105 bg-[var(--accent-primary)] text-[var(--accent-contrast)]"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" /> إعادة المحاولة
          </button>
          <button
            type="button"
            onClick={this.goHome}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 font-bold text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)]"
          >
            الصفحة الرئيسية
          </button>
        </div>
      </div>
    );
  }
}
