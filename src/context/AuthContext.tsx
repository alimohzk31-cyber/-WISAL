import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, adminPinLogin } from '../lib/supabase';
import { measureAdminOperation } from '../lib/adminPerformance';

// ---------------------------------------------------------------------------
// AuthContext — SECURITY PHASE 1
// Real Supabase Auth identity (auth.uid()).
// The admin role is read from the DATABASE via the public.is_admin() RPC
// (stored in public.profiles) — never trusted from a client header or PIN.
// ---------------------------------------------------------------------------

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  hasFreshPinVerification: boolean;
  beginAdminPinAttempt: () => void;
  loginWithPin: (pin: string) => Promise<{ ok: boolean; code?: string }>;
  refreshAdmin: () => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinVerifiedUserId, setPinVerifiedUserId] = useState('');
  const explicitLogin = useRef(false);
  const currentToken = useRef('');
  const roleRequest = useRef<{ token: string; promise: Promise<boolean> } | null>(null);
  const pinVerifiedUserIdRef = useRef('');

  const clearPinVerification = useCallback(() => {
    pinVerifiedUserIdRef.current = '';
    setPinVerifiedUserId('');
  }, []);

  // A persisted Supabase session is never proof that a PIN was entered in
  // this page load. Opening a new PIN prompt revokes any in-memory grant.
  const beginAdminPinAttempt = useCallback(() => {
    clearPinVerification();
    setIsAdmin(false);
  }, [clearPinVerification]);

  // The only source of truth for "is admin" is the database.
  const refreshAdmin = useCallback(async (): Promise<boolean> => {
    const token = currentToken.current;
    // Share only concurrent checks for this exact session, never a cached permission.
    if (roleRequest.current?.token === token) return roleRequest.current.promise;
    const promise = (async () => {
      try {
        const { data, error } = await measureAdminOperation('is_admin.context', () => supabase.rpc('is_admin'));
        if (currentToken.current !== token) return false;
        if (error) console.error('[Auth] is_admin RPC failed:', { message: error.message, code: error.code });
        const allowed = !error && data === true;
        setIsAdmin(allowed);
        return allowed;
      } catch {
        if (currentToken.current === token) setIsAdmin(false);
        return false;
      }
    })();
    roleRequest.current = { token, promise };
    try { return await promise; }
    finally { if (roleRequest.current?.promise === promise) roleRequest.current = null; }
  }, []);

  // One-time PIN login: the PIN is verified on the server (Edge Function),
  // which mints a real Supabase Auth session for the admin account. We install
  // it here and re-confirm the admin role from the database.
  const loginWithPin = useCallback(async (pin: string): Promise<{ ok: boolean; code?: string }> => {
    beginAdminPinAttempt();
    if (typeof pin !== 'string' || pin.trim() === '') return { ok: false, code: 'invalid_pin' };

    explicitLogin.current = true;
    try {
      const result = await adminPinLogin(pin);
      if (!result.ok) return result;

      // Bind the temporary PIN grant to an Auth session returned by this
      // attempt and independently confirm the user before enabling the route.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const freshSession = sessionData.session;
      if (sessionError || !freshSession || freshSession.expires_at * 1000 <= Date.now()) {
        throw new Error('Admin PIN login did not produce a live session.');
      }
      const { data: userData, error: userError } = await supabase.auth.getUser(freshSession.access_token);
      if (userError || userData.user?.id !== freshSession.user.id) {
        throw new Error('Admin PIN session identity verification failed.');
      }
      currentToken.current = freshSession.access_token;
      setSession(freshSession);
      setUser(freshSession.user);

      const admin = await refreshAdmin();
      if (admin) {
        pinVerifiedUserIdRef.current = freshSession.user.id;
        setPinVerifiedUserId(freshSession.user.id);
        return { ok: true };
      }
      // The Edge Function already checks the profile, but fail closed again
      // if the independent database verification disagrees for any reason.
      await supabase.auth.signOut({ scope: 'local' });
      currentToken.current = '';
      setSession(null);
      setUser(null);
      setIsAdmin(false);
      return { ok: false, code: 'not_admin' };
    } catch (error) {
      clearPinVerification();
      setIsAdmin(false);
      try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* deny even if local cleanup fails */ }
      currentToken.current = '';
      setSession(null);
      setUser(null);
      console.error('[Auth] PIN verification failed closed:', error);
      return { ok: false, code: 'server_error' };
    } finally { explicitLogin.current = false; }
  }, [beginAdminPinAttempt, clearPinVerification, refreshAdmin]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.error('[Auth] Initial session lookup failed:', { message: error.message, code: error.code });
      currentToken.current = data.session?.access_token ?? '';
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      if (data.session?.user) void refreshAdmin();
    }).catch(error => {
      if (!mounted) return;
      console.error('[Auth] Initial session lookup rejected:', error);
      currentToken.current = '';
      setSession(null);
      setUser(null);
      setIsAdmin(false);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      const nextToken = newSession?.access_token ?? '';
      if (currentToken.current !== nextToken) setIsAdmin(false);
      currentToken.current = nextToken;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      const identityChanged = Boolean(newSession && pinVerifiedUserIdRef.current && pinVerifiedUserIdRef.current !== newSession.user.id);
      const sessionReplacedOutsidePin = Boolean(newSession && !explicitLogin.current && event !== 'TOKEN_REFRESHED' && event !== 'INITIAL_SESSION' && pinVerifiedUserIdRef.current);
      if (!newSession || identityChanged || sessionReplacedOutsidePin) {
        clearPinVerification();
      }
      if (newSession?.user) {
        // Run database calls after the auth callback releases its session lock.
        // PIN login already awaits its own fresh DB verification after setSession.
        if (!explicitLogin.current) setTimeout(() => { if (mounted) void refreshAdmin(); }, 0);
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [clearPinVerification, refreshAdmin]);

  const signIn = useCallback(async (email: string, password: string) => {
    beginAdminPinAttempt();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) await refreshAdmin();
    return { error: error?.message ?? null };
  }, [beginAdminPinAttempt, refreshAdmin]);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: fullName ? { data: { full_name: fullName } } : undefined,
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    beginAdminPinAttempt();
    await supabase.auth.signOut();
    setIsAdmin(false);
  }, [beginAdminPinAttempt]);

  const hasFreshPinVerification = Boolean(user?.id && pinVerifiedUserId === user.id);

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, hasFreshPinVerification, beginAdminPinAttempt, loginWithPin, refreshAdmin, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
