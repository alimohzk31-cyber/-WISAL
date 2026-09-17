import { createClient } from '@supabase/supabase-js';
import { adminTimedFetch, measureAdminOperation } from './adminPerformance';

// ---------- SECURITY PHASE 1 ----------
// Only publishable (anon) credentials live in the frontend.
// NEVER put a service_role key or a database password here.
// Identity comes from Supabase Auth (auth.uid()) — the forgeable
// client headers (x-owner-id / x-admin-mode) have been REMOVED.
// --------------------------------------
// Node-safe access (runtime tests import this module outside Vite; the browser
// build always has import.meta.env defined by Vite itself).
const env = ((import.meta as any).env ?? {}) as Record<string, string | undefined>;
export const supabaseUrl = env.VITE_SUPABASE_URL || 'https://nnxrjpitjxtceydlcxzm.supabase.co';
export const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ueHJqcGl0anh0Y2V5ZGxjeHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDkyMjMsImV4cCI6MjA5MTIyNTIyM30.Ui1IQ4OOJ8wngBoNIBNe0nTCQgfm0q8P7AjrKhyAU4w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: adminTimedFetch },
  auth: {
    persistSession: true,       // keep the authenticated session across reloads
    autoRefreshToken: true,
    detectSessionInUrl: true,   // support email confirmation / OAuth redirects
  },
});

if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  console.warn("WARNING: Using hardcoded Supabase credentials because environment variables are missing.");
}

// ---------------------------------------------------------------------------
// Admin PIN login (Server-side verification via Edge Function).
// The PIN is validated on the server using Secrets, and the Edge Function
// mints a real Supabase Auth session for the admin account. It returns only
// the session tokens; we install them with setSession(). The single app-wide
// AuthProvider then picks the session up automatically.
// NEVER store ADMIN_PIN / ADMIN_EMAIL / ADMIN_PASSWORD / service_role here.
// ---------------------------------------------------------------------------

interface AdminPinResponse {
  ok?: boolean;
  success?: boolean;
  access_token?: string;
  refresh_token?: string;
  code?: string;
}

async function clearLocalAuthSession(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Local 429 rate-limit guard (frontend defense-in-depth).
// ---------------------------------------------------------------------------
// When the server returns 429, we record a local ban window in localStorage
// so that NO further PIN attempts — correct OR incorrect — reach the Edge
// Function until the window expires.
//
// Why this is needed: the Edge Function validates the PIN *before* checking
// the rate-limit counter, so a correct PIN can bypass a server-side 429. The
// local ban guarantees the frontend never sends the PIN while banned, which
// means setSession() is never called after 429 regardless of server
// behavior.
//
// Security notes:
//  - The stored value is only an expiry timestamp (ms since epoch). NO PIN,
//    password, token, or secret is ever stored client-side.
//  - localStorage is per-origin, so the ban is scoped to this application
//    only and cannot leak to other origins.
//  - On successful login the ban is cleared, so a legitimate user who
//    eventually enters the correct PIN after the window expires is unaffected.
// ---------------------------------------------------------------------------

const RATE_LIMIT_STORAGE_KEY = 'admin_pin_rate_limit_ban_until';
const RATE_LIMIT_DEFAULT_MS = 15 * 60 * 1000; // 15 min — matches the server window

/** Returns the ban expiry timestamp in ms (0 if no active ban). */
function getPinRateLimitBanUntil(): number {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!raw) return 0;
    const expiresAt = parseInt(raw, 10);
    return Number.isFinite(expiresAt) && expiresAt > Date.now() ? expiresAt : 0;
  } catch {
    // localStorage unavailable (private mode, SSR, etc.) — no local ban.
    return 0;
  }
}

/** Returns true when the client is inside a 429 ban window. */
export function isPinRateLimited(): boolean {
  return getPinRateLimitBanUntil() > 0;
}

/** Returns remaining ban time in ms (0 if not banned). Exposed for UI/tests. */
export function getPinRateLimitRemainingMs(): number {
  const banUntil = getPinRateLimitBanUntil();
  return banUntil > 0 ? banUntil - Date.now() : 0;
}

/** Clears the local 429 ban (called on successful login). Exposed for tests. */
export function clearPinRateLimit(): void {
  try {
    localStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Sets a local 429 ban.
 * @param retryAfterSeconds  Retry-After value from the server (seconds).
 *                           Falls back to RATE_LIMIT_DEFAULT_MS when absent
 *                           or invalid.
 */
function setPinRateLimit(retryAfterSeconds?: number): void {
  try {
    const durationMs =
      typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : RATE_LIMIT_DEFAULT_MS;
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, String(Date.now() + durationMs));
  } catch {
    // ignore — server still enforces its own rate limit
  }
}

export async function adminPinLogin(
  pin: string
): Promise<{ ok: true } | { ok: false; code: string }> {
    // A PIN attempt always starts from a blank local auth state. Otherwise a
    // previously persisted admin refresh token can make a failed PIN appear
    // successful when the user later opens /admin directly.
    if (!(await clearLocalAuthSession())) {
      return { ok: false, code: 'session_clear_failed' };
    }

    // Defense-in-depth: if we already hold a local 429 ban, refuse
    // immediately — do NOT send the PIN to the server. This guarantees
    // that even a correct PIN cannot create a session while banned,
    // regardless of any server-side rate-limit-before-PIN-comparison bug.
    if (isPinRateLimited()) {
      return { ok: false, code: 'rate_limited' };
    }

    let data: AdminPinResponse | null = null;
  try {
    const res = await measureAdminOperation('admin-login', () => supabase.functions.invoke<AdminPinResponse | null>('admin-login', {
      body: { pin },
    }));

    // Fail-closed: any error (HTTP or network) must stop immediately.
    // The PIN is verified server-side only — we never compare it locally.
    // We never call setSession() from an error response.
    if (res.error) {
      const response = res.response;
      if (response) {
        // HTTP error (FunctionsHttpError / FunctionsRelayError):
        // the Response carries the HTTP status and the JSON body
        // from the Edge Function.
        if (response.status === 429) {
          // Parse the server-provided Retry-After (seconds) to scope
          // the local ban to the exact window the server mandates.
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfterSeconds = retryAfterHeader
            ? parseInt(retryAfterHeader, 10)
            : undefined;
          setPinRateLimit(retryAfterSeconds);
          // Rate-limited: stop immediately — no session, no retry,
          // no PIN comparison. The process is terminated here.
          return { ok: false, code: 'rate_limited' };
        }
        // Parse the error body to surface the precise server-side code
        // (e.g. 'invalid_pin', 'not_admin', 'server_error', etc.).
        try {
          const body = await response.clone().json();
          if (body && typeof body.code === 'string') {
            return { ok: false, code: body.code };
          }
        } catch {
          // Body is not JSON — fall through to generic error.
        }
        // HTTP error without a recognizable JSON body.
        return { ok: false, code: 'server_error' };
      }
      // Network error (FunctionsFetchError): no Response object.
      return { ok: false, code: 'network' };
    }

    data = res.data;
  } catch {
    // Any unexpected error — fail closed, never create a session.
    return { ok: false, code: 'network' };
  }

  // Fail-closed: no body means no session.
  if (!data) return { ok: false, code: 'server_error' };
  if (data.code) return { ok: false, code: data.code };
  // Accept either positive flag: "ok" (current shape) or "success"
  // (the Edge Function's response shape). Any response that carries
  // neither flag — even if it happens to include tokens — fails closed
  // as server_error: we never install a session from an unconfirmed success.
  const accepted = data.ok === true || data.success === true;
  if (!accepted || typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') {
    return { ok: false, code: 'server_error' };
  }

  // Only on a verified 2xx response with valid tokens do we create a session.
  const { error: setError } = await measureAdminOperation('setSession', () => supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  }));
  if (setError) {
    await clearLocalAuthSession();
    return { ok: false, code: 'server_error' };
  }
  // Success — clear any previous local ban so the user can log in normally
  // if they retry after the window expires.
  clearPinRateLimit();
  return { ok: true };
}
