import React, { useEffect, useRef, useState } from 'react';
import { Fingerprint, KeyRound, Lock, X, Loader2 } from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { isWindowsHelloAvailable } from '../lib/adminPasskeys';

const LOGIN_ERRORS: Record<string, string> = {
  invalid_pin: 'رمز الدخول غير صحيح. حاول مرة أخرى.',
  rate_limited: 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.',
  not_admin: 'هذا الحساب لا يملك صلاحيات إدارية.',
  server_error: 'تعذر الدخول حالياً. حاول لاحقاً.',
  network: 'تعذر الاتصال بالخادم. تحقق من الاتصال.',
  session_clear_failed: 'تعذر إنهاء جلسة الإدارة السابقة بأمان. أعد تشغيل التطبيق وحاول مجدداً.',
  passkey_cancelled: 'تم إلغاء التحقق بالبصمة.',
  passkey_not_supported: 'Windows Hello غير متوفر على هذا الجهاز أو المتصفح. استخدم PIN.',
  passkey_not_configured: 'لم يتم إعداد تسجيل الدخول بالبصمة على الخادم بعد. استخدم PIN.',
  passkey_not_registered: 'لم يتم تسجيل هذا الجهاز للإدارة بعد. استخدم PIN لتسجيله.',
  challenge_invalid: 'انتهت صلاحية محاولة البصمة. أعد المحاولة.',
  webauthn_failed: 'تعذر التحقق من بصمة Windows Hello.',
  passkey_already_registered: 'تم تسجيل هذا الجهاز مسبقاً.',
  pin_required: 'يجب التحقق باستخدام PIN قبل تسجيل جهاز جديد.',
  enrollment_not_authorized: 'يلزم تسجيل دخول PIN حديث قبل تسجيل جهاز بالبصمة.',
  enrollment_replay: 'انتهت صلاحية تفويض التسجيل. أعد الدخول باستخدام PIN.',
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
  const [passkeyAvailable, setPasskeyAvailable] = useState<boolean | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [pinVerifiedForEnrollment, setPinVerifiedForEnrollment] = useState(false);
  const pinInputInteracted = useRef(false);
  const { t } = useLanguage();
  const { loginWithPin, loginWithPasskey, registerAdminPasskey } = useAuth();

  useEffect(() => {
    setPin('');
    setErrorMsg(null);
    pinInputInteracted.current = false;
    setPinVerifiedForEnrollment(false);

    let active = true;
    void isWindowsHelloAvailable().then((available) => {
      if (active) setPasskeyAvailable(available);
    });
    return () => {
      active = false;
    };
  }, []);

  const getLoginError = (code?: string) => LOGIN_ERRORS[code ?? ''] ?? DEFAULT_LOGIN_ERROR;

  const handlePasskey = async () => {
    if (passkeyBusy || submitting || passkeyAvailable !== true) return;
    setPasskeyBusy(true);
    setErrorMsg(null);
    try {
      const result = await loginWithPasskey();
      if (result.ok) {
        onSuccess();
      } else {
        setErrorMsg(getLoginError(result.code));
      }
    } catch {
      setErrorMsg(LOGIN_ERRORS.webauthn_failed);
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleRegisterPasskey = async () => {
    if (passkeyBusy) return;
    setPasskeyBusy(true);
    setErrorMsg(null);
    try {
      const result = await registerAdminPasskey();
      if (result.ok) {
        onSuccess();
      } else {
        setErrorMsg(getLoginError(result.code));
      }
    } catch {
      setErrorMsg(LOGIN_ERRORS.webauthn_failed);
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || pinVerifiedForEnrollment) return;
    const submittedPin = pin.trim();

    if (submittedPin === '' || !pinInputInteracted.current) {
      setErrorMsg(LOGIN_ERRORS.invalid_pin);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await loginWithPin(submittedPin);
      if (result.ok) {
        if (passkeyAvailable === true) {
          setPinVerifiedForEnrollment(true);
        } else {
          onSuccess();
        }
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
            {pinVerifiedForEnrollment ? (
              <>
                <KeyRound className="mx-auto h-10 w-10 text-[var(--accent-primary)]" />
                <p className="text-sm font-bold text-[var(--text-primary)]">تم التحقق من PIN بنجاح.</p>
                <p className="text-xs leading-6 text-[var(--text-muted)]">
                  يمكنك تسجيل هذا الجهاز لاستخدام Windows Hello في المرات القادمة.
                </p>
                {errorMsg && <p className="text-sm font-bold text-red-500">{errorMsg}</p>}
                <button
                  type="button"
                  onClick={handleRegisterPasskey}
                  disabled={passkeyBusy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] py-3 font-bold text-white shadow-[0_0_15px_var(--glow)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {passkeyBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Fingerprint className="h-5 w-5" />}
                  تسجيل هذا الجهاز بالبصمة
                </button>
                <button
                  type="button"
                  onClick={onSuccess}
                  disabled={passkeyBusy}
                  className="w-full rounded-xl border border-[var(--border)] py-3 font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-60"
                >
                  المتابعة باستخدام PIN
                </button>
              </>
            ) : (
              <>
                {passkeyAvailable === true && (
                  <button
                    type="button"
                    onClick={handlePasskey}
                    disabled={passkeyBusy || submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent-primary)] py-3 font-bold text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {passkeyBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Fingerprint className="h-5 w-5" />}
                    الدخول بالبصمة / Windows Hello
                  </button>
                )}
                {passkeyAvailable === false && (
                  <p className="text-xs leading-5 text-[var(--text-muted)]">Windows Hello غير متوفر. استخدم PIN للدخول.</p>
                )}
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span className="h-px flex-1 bg-[var(--border)]" />
                  <span>أو استخدم PIN الحالي</span>
                  <span className="h-px flex-1 bg-[var(--border)]" />
                </div>
                <input
                  type="password"
                  name="admin-pin"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setErrorMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
                      pinInputInteracted.current = true;
                    }
                  }}
                  onPaste={() => { pinInputInteracted.current = true; }}
                  className={`w-full rounded-xl border px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] transition-all focus:border-[var(--accent-primary)] focus:outline-none focus:shadow-[0_0_0_3px_var(--focus-ring)] ${errorMsg ? 'border-red-500' : 'border-[var(--input-border)]'} bg-[var(--input-bg)] text-[var(--text-primary)]`}
                  placeholder="••••••"
                  maxLength={6}
                  autoFocus
                  autoComplete="new-password"
                  inputMode="numeric"
                  dir="ltr"
                />
                {errorMsg && <p className="text-sm font-bold text-red-500">{errorMsg}</p>}
              </>
            )}
          </div>

          {!pinVerifiedForEnrollment && (
            <button
              type="submit"
              disabled={submitting || passkeyBusy}
              className="app-btn-accent mt-6 flex w-full items-center justify-center rounded-xl py-3 font-bold shadow-[0_0_15px_var(--glow)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Lock className="mr-2 inline-block h-4 w-4" />{t('login')}</>}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
