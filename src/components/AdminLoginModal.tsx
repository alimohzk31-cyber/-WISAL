import React, { useState } from 'react';
import { Lock, X, Loader2 } from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

// رسائل عربية عامة — لا تكشف أي تفاصيل أمنية أو تقنية.
const LOGIN_ERRORS: Record<string, string> = {
  invalid_pin: 'رمز الدخول غير صحيح. حاول مرة أخرى.',
  rate_limited: 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.',
  not_admin: 'هذا الحساب لا يملك صلاحيات إدارية.',
  server_error: 'تعذر الدخول حاليًا. حاول لاحقًا.',
  network: 'تعذر الاتصال بالخادم. تحقق من الاتصال.',
  session_clear_failed: 'تعذر إنهاء جلسة الإدارة السابقة بأمان. أعد تشغيل التطبيق وحاول مجددًا.',
};
const DEFAULT_LOGIN_ERROR = 'تعذر الدخول. حاول مرة أخرى.';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdminLoginModal({ onClose, onSuccess }: Props) {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useLanguage();
  const { loginWithPin } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // رفض محلي صريح لـ PIN الفارغ — لا نرسلها للخادم،
    // لأن محاولة إرسال PIN فارغة قد تُسجّل كمحاولة فاشلة.
    if (pin.trim() === '') {
      setErrorMsg(LOGIN_ERRORS.invalid_pin);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    const result = await loginWithPin(pin);
    if (result.ok) {
      onSuccess();
    } else {
      setErrorMsg(LOGIN_ERRORS[result.code ?? ''] ?? DEFAULT_LOGIN_ERROR);
      setPin('');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex min-w-0 items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4">
      <div className="relative w-full min-w-0 max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-lg)] animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-soft)]"
        >
          <X className="w-5 h-5" />
        </button>
        
        <form onSubmit={handleSubmit} className="min-w-0 p-4 pt-12 sm:p-6 sm:pt-12">
          <div className="space-y-2 text-center">
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setErrorMsg(null);
              }}
              className={`w-full border rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all font-bold ${errorMsg ? 'border-red-500' : 'border-[var(--input-border)]'} bg-[var(--input-bg)] text-[var(--text-primary)]`}
              placeholder="••••••"
              maxLength={6}
              autoFocus
              dir="ltr"
            />
            {errorMsg && <p className="text-red-500 text-sm font-bold">{errorMsg}</p>}
          </div>
          
          <button
            type="submit"
            disabled={submitting}
            className="w-full app-btn-accent font-bold py-3 rounded-xl mt-6 shadow-[0_0_15px_var(--glow)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : t('login')}
          </button>
        </form>
      </div>
    </div>
  );
}
