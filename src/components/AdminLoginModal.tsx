import React, { useRef, useState } from 'react';
import { Lock, X, Loader2 } from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const LOGIN_ERRORS: Record<string, string> = {
  invalid_pin: 'رمز الدخول غير صحيح. حاول مرة أخرى.',
  rate_limited: 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.',
  not_admin: 'هذا الحساب لا يملك صلاحيات إدارية.',
  server_error: 'تعذر الدخول حالياً. حاول لاحقاً.',
  auth_failure: 'تعذر التحقق من حساب الإدارة. حاول لاحقاً.',
  authorization_failure: 'تعذر التحقق من صلاحيات الإدارة. حاول لاحقاً.',
  network: 'تعذر الاتصال بالخادم. تحقق من الاتصال.',
  session_clear_failed: 'تعذر إنهاء جلسة الإدارة السابقة بأمان. أعد تشغيل التطبيق وحاول مجدداً.',
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
  const submittingRef = useRef(false);
  const pinInputInteracted = useRef(false);
  const { t } = useLanguage();
  const { loginWithPin } = useAuth();

  const getLoginError = (code?: string) => LOGIN_ERRORS[code ?? ''] ?? DEFAULT_LOGIN_ERROR;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || submittingRef.current) return;
    const submittedPin = pin.trim();

    if (submittedPin === '' || !pinInputInteracted.current) {
      setErrorMsg(LOGIN_ERRORS.invalid_pin);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await loginWithPin(submittedPin);
      if (result.ok) {
        onSuccess();
      } else {
        setErrorMsg(getLoginError(result.code));
        setPin('');
        pinInputInteracted.current = false;
      }
    } catch {
      setErrorMsg(DEFAULT_LOGIN_ERROR);
      setPin('');
      pinInputInteracted.current = false;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex min-w-0 items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4">
      <div className="relative w-full min-w-0 max-w-sm overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-lg)] animate-in fade-in zoom-in duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]"
        >
          <X className="h-5 w-5" />
        </button>

        <form onSubmit={handleSubmit} className="min-w-0 p-4 pt-12 sm:p-6 sm:pt-12">
          <div className="space-y-3 text-center">
            <input
              type="password"
              name="admin-pin"
              value={pin}
              onChange={(e) => {
                // Mobile keyboards, IME and browser fill can change the value
                // without a printable keydown or paste event. Authentication
                // still depends exclusively on the server's PIN verification.
                pinInputInteracted.current = true;
                setPin(e.target.value);
                setErrorMsg(null);
              }}
              onKeyDown={(e) => {
                if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
                  pinInputInteracted.current = true;
                }
              }}
              onPaste={() => { pinInputInteracted.current = true; }}
              className={`w-full rounded-xl border px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] transition-all focus:border-[var(--accent-primary)] focus:outline-none focus:shadow-[0_0_0_3px_var(--focus-ring)] ${errorMsg ? 'border-[var(--theme-primary)]' : 'border-[var(--input-border)]'} bg-[var(--input-bg)] text-[var(--text-primary)]`}
              placeholder="••••••"
              maxLength={6}
              autoFocus
              autoComplete="new-password"
              inputMode="numeric"
              dir="ltr"
            />
            {errorMsg && <p className="text-sm font-bold text-[var(--theme-primary)]">{errorMsg}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="app-btn-accent mt-6 flex w-full items-center justify-center rounded-xl py-3 font-bold shadow-[0_0_15px_var(--glow)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Lock className="mr-2 inline-block h-4 w-4" />{t('login')}</>}
          </button>
        </form>
      </div>
    </div>
  );
}
