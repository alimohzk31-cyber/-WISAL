import React, { useState, useEffect } from 'react';
import { Shield, Mail, Lock, Eye, EyeOff, X, LogOut, LogIn, UserPlus, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

// ---------------------------------------------------------------------------
// AdminLoginView — SECURITY PHASE 1
// Replaces the old PIN gate. Pure email/password Authentication via Supabase.
// It renders a login/signup card (same look & feel as the previous modal card).
// The admin decision comes from the DATABASE (public.is_admin()) only.
// ---------------------------------------------------------------------------

interface Props {
  onClose?: () => void;
  onSuccess?: () => void;
  /** When true, the view shows "this account has no admin rights" instead of the form. */
  accessDenied?: boolean;
}

export default function AdminLoginView({ onClose, onSuccess, accessDenied = false }: Props) {
  const { user, isAdmin, signIn, signUp, signOut, refreshAdmin } = useAuth();
  const { t } = useLanguage();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [working, setWorking] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Whenever the DB confirms the logged-in user IS an admin -> notify parent.
  useEffect(() => {
    if (user && isAdmin) {
      onSuccess?.();
    }
  }, [user, isAdmin, onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (working) return;
    setWorking(true);
    setErrorMsg('');
    setInfoMsg('');
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          setErrorMsg(error);
          return;
        }
        const ok = await refreshAdmin();
        if (ok) {
          onSuccess?.();
        } else {
          setInfoMsg('تم تسجيل الدخول، لكن هذا الحساب لا يملك صلاحيات إدارية.');
        }
      } else {
        const { error } = await signUp(email.trim(), password, fullName.trim());
        if (error) {
          setErrorMsg(error);
          return;
        }
        setInfoMsg('تم إنشاء الحساب. تحقق من بريدك لتأكيد التسجيل، ثم سجّل الدخول.');
        setMode('signin');
      }
    } finally {
      setWorking(false);
    }
  };

  const inputCls =
    `w-full border rounded-xl px-4 py-3 text-center focus:outline-none focus:border-[var(--accent-primary)] ` +
    `focus:shadow-[0_0_0_3px_var(--focus-ring)] transition-all font-bold bg-[var(--input-bg)] ` +
    `border-[var(--input-border)] text-[var(--text-primary)]`;

  return (
    <div className={`w-full max-w-sm border rounded-2xl shadow-[var(--shadow-lg)] overflow-hidden relative bg-[var(--surface-elevated)] border-[var(--border)]`}>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-soft)]"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="p-6 pt-12">
        <div className="space-y-2 text-center mb-5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center">
            <Shield className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">{t('admin_login')}</h2>
        </div>

        {accessDenied ? (
          <div className="space-y-4 text-center">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 text-sm font-bold flex items-center gap-2 justify-center">
              <AlertCircle className="w-4 h-4 shrink-0" />
              هذا الحساب لا يملك صلاحيات إدارية.
            </div>
            {user && (
              <button
                onClick={() => void signOut()}
                className="w-full app-btn-accent font-bold py-3 rounded-xl mt-2 flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" /> تسجيل الخروج
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputCls + ' pr-11'}
                  placeholder="الاسم (اختياري)"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls + ' pr-11 text-left'}
                placeholder="email@example.com"
                autoComplete="email"
              />
            </div>

            <div className="relative">
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type={showPw ? 'text' : 'password'}
                required
                dir="ltr"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls + ' pr-11 text-left'}
                placeholder="••••••••"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {errorMsg && (
              <p className="text-red-500 text-sm font-bold text-center">{errorMsg}</p>
            )}
            {infoMsg && (
              <p className="text-emerald-600 text-sm font-bold text-center flex items-center gap-1 justify-center">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {infoMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={working}
              className="w-full app-btn-accent font-bold py-3 rounded-xl mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {working ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('saving')}
                </>
              ) : mode === 'signin' ? (
                <>
                  <LogIn className="w-4 h-4" /> {t('login')}
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> إنشاء حساب
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setMode((m) => (m === 'signin' ? 'signup' : 'signin')); setErrorMsg(''); setInfoMsg(''); }}
              className="w-full text-center text-sm font-bold text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors pt-1"
            >
              {mode === 'signin' ? 'ليس لديك حساب؟ أنشئ حساباً' : 'لديك حساب؟ سجّل الدخول'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}