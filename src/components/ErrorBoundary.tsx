import { Component, type ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('تعذر عرض الصفحة:', error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" dir="rtl" className="p-8 text-center space-y-4">
        <p>تعذر فتح الصفحة. تحقق من اتصال الإنترنت ثم أعد المحاولة.</p>
        <button type="button" className="px-5 py-3 rounded-xl bg-[var(--accent-primary)] text-white" onClick={() => window.location.reload()}>إعادة المحاولة</button>
        <a className="block underline" href="#/" onClick={() => this.setState({ failed: false })}>العودة للرئيسية</a>
      </div>
    );
  }
}
