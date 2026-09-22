import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

let sessionCreation: Promise<User> | null = null;

/** Reuse the app's Supabase Auth session; create its anonymous session only when needed. */
export function ensureUserSession(): Promise<User> {
  if (sessionCreation) return sessionCreation;
  sessionCreation = (async () => {
    const { data: current } = await supabase.auth.getSession();
    if (current.session?.user) return current.session.user;
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) throw error ?? new Error('تعذر إنشاء جلسة المستخدم.');
    return data.user;
  })();
  const request = sessionCreation;
  void request.finally(() => { if (sessionCreation === request) sessionCreation = null; }).catch(() => undefined);
  return request;
}
