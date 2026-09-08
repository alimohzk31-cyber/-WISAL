import { useEffect, useState } from 'react';
import { Navigate, Outlet, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// This boundary must resolve before AdminDashboard (and its queries) mounts.
export default function AdminRoute() {
  const { session, user, loading } = useAuth();
  const outletContext = useOutletContext();
  const token = session?.access_token ?? '';
  const userId = session?.user.id ?? '';
  const expiresAt = session?.expires_at ?? 0;
  const key = `${token}:${userId}:${expiresAt}`;
  const [verification, setVerification] = useState<{ key: string; allowed: boolean } | null>(null);

  useEffect(() => {
    if (loading || !token || !userId || !Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now()) return;

    let cancelled = false;
    const controller = new AbortController();
    const deny = () => {
      if (cancelled) return;
      cancelled = true;
      controller.abort();
      setVerification({ key, allowed: false });
    };
    setVerification(null);
    // A hung identity/role request must not leave the route open or loading forever.
    const timeout = window.setTimeout(deny, 10000);
    // Supabase normally refreshes the token. If it cannot, remove the dashboard.
    const expiryTimer = window.setTimeout(deny, Math.min(expiresAt * 1000 - Date.now(), 2147483647));

    const verify = async () => {
      try {
        // Validate with Auth, rather than trusting the cached session user.
        const { data, error } = await supabase.auth.getUser(token);
        if (cancelled) return;
        if (error || data.user?.id !== userId) { deny(); return; }
        const role = await supabase.rpc('is_admin')
          .setHeader('Authorization', `Bearer ${token}`)
          .abortSignal(controller.signal);
        if (cancelled) return;
        if (role.error || role.data !== true || expiresAt * 1000 <= Date.now()) { deny(); return; }
        window.clearTimeout(timeout);
        setVerification({ key, allowed: true });
      } catch {
        deny();
      }
    };
    void verify();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
      window.clearTimeout(expiryTimer);
    };
  }, [loading, token, userId, expiresAt, key]);

  if (!loading && (!token || !user || user.id !== userId || !Number.isFinite(expiresAt) || expiresAt * 1000 <= Date.now())) {
    return <Navigate to="/" replace />;
  }
  if (loading || verification?.key !== key) {
    return <div role="status" aria-live="polite" className="p-8 text-center text-[var(--text-muted)]" dir="rtl">جارٍ التحقق من صلاحية الدخول إلى الإدارة...</div>;
  }
  if (!verification.allowed) return <Navigate to="/" replace />;
  return <Outlet context={outletContext} />;
}
