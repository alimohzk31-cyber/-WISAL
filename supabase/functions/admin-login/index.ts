/**
 * admin-login — تحويل رمز PIN إلى جلسة Supabase Auth حقيقية (Server-side).
 *
 * الأمان:
 * - العميل يرسل { pin } فقط، ولا يرسل email/password أبداً.
 * - بيانات حساب الإدارة (ADMIN_EMAIL / ADMIN_PASSWORD) في Secrets الخادم فقط.
 * - التحقق من الصلاحية يتم بمعرّف المستخدم (session.user.id) مقابل public.profiles
 *   وليس بالبريد.
 * - عند النجاح يُعاد access_token + refresh_token فقط. لا يُعاد أي Secret.
 * - حماية من brute-force عبر Deno KV؛ عند تجاوز الحد يُعاد HTTP 429.
 * - لا تُسجَّل قيم PIN أو كلمة المرور أو التوكنات في أي مكان.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import { pinsMatch } from './pin-security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const ADMIN_PIN = Deno.env.get('ADMIN_PIN') ?? '';
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') ?? '';
const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD') ?? '';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 دقيقة
const RATE_LIMIT_MAX_FAILURES = 5;
const ENROLLMENT_AUTH_TTL_MS = 5 * 60 * 1000;

const DEFAULT_CORS_ORIGINS = new Set<string>([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'capacitor://localhost',
  'https://localhost',
]);

function getAllowedOrigin(req: Request): string | null {
  const origin = req.headers.get('origin');
  if (!origin) return null; // نفس الأصل / غير متصفح / تطبيقات أصلية
  const extra = Deno.env.get('CORS_ORIGINS') ?? '';
  const allowed = new Set(DEFAULT_CORS_ORIGINS);
  for (const item of extra.split(',')) {
    const trimmed = item.trim();
    if (trimmed) allowed.add(trimmed);
  }
  return allowed.has(origin) ? origin : null;
}

function clientIp(req: Request): string {
  // Only use headers supplied by the hosting platform/reverse proxy. The
  // client-controlled x-forwarded-for header must not define the rate-limit key.
  for (const header of ['cf-connecting-ip', 'x-real-ip']) {
    const value = req.headers.get(header)?.trim();
    if (value && value.length <= 128 && !value.includes(',')) return value;
  }
  // This limiter is defense-in-depth; PIN validation and the server-side admin
  // identity check remain the security boundary when no trusted IP is present.
  return 'unknown';
}

/**
 * يعدّ محاولة فاشلة لهذا الـ IP داخل النافذة الزمنية.
 * Fail-closed: إذا تعذّر الوصول إلى KV نعتبر المحاولة تجاوزاً للحد —
 * لا يُترك المدخل أبداً بدون حماية ضد brute-force.
 */
async function countFailure(ip: string): Promise<number> {
  try {
    const kv = await Deno.openKv();
    const windowStart = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
    const key = ['admin-login', 'failures', String(windowStart), ip];
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await kv.get<number>(key);
      const next = (current.value ?? 0) + 1;
      const committed = await kv
        .atomic()
        .check(current)
        .set(key, next, { expireIn: RATE_LIMIT_WINDOW_MS })
        .commit();
      if (committed.ok) return next;
    }
  } catch {
    // تجاهل — يُعامل على أنه تجاوز للحد في الأسفل (fail-closed).
  }
  return RATE_LIMIT_MAX_FAILURES + 1;
}

function respond(
  body: unknown,
  status: number,
  corsOrigin: string | null,
  extraHeaders: Record<string, string> = {},
): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
    headers['Vary'] = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function bytesToBase64Url(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function issuePasskeyEnrollmentAuthorization(userId: string): Promise<string | null> {
  try {
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = bytesToBase64Url(tokenBytes);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const tokenHash = bytesToBase64Url(new Uint8Array(digest));

    const { error } = await createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
      .from('admin_webauthn_enrollment_authorizations')
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + ENROLLMENT_AUTH_TTL_MS).toISOString(),
      });

    // Keep the existing PIN login usable if the optional WebAuthn schema has not
    // been deployed yet. Without a persisted row, no enrollment authorization
    // is returned and registration remains denied server-side.
    return error ? null : token;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const corsOrigin = getAllowedOrigin(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsOrigin
        ? {
            'Access-Control-Allow-Origin': corsOrigin,
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            'Access-Control-Max-Age': '86400',
            Vary: 'Origin',
          }
        : undefined,
    });
  }

  if (req.method !== 'POST') {
    return respond({ ok: false, code: 'method_not_allowed', error: 'Method not allowed' }, 405, corsOrigin);
  }

  let pin = '';
  try {
    const body = (await req.json()) as { pin?: unknown };
    pin = typeof body.pin === 'string' ? body.pin : '';
  } catch {
    return respond({ ok: false, code: 'bad_request', error: 'Bad request' }, 400, corsOrigin);
  }

  if (pin.trim() === '') {
    return respond({ ok: false, code: 'bad_request', error: 'PIN is required' }, 400, corsOrigin);
  }

  if (!ADMIN_PIN || !ADMIN_EMAIL || !ADMIN_PASSWORD || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return respond({ ok: false, code: 'server_error', error: 'Admin login is not configured' }, 500, corsOrigin);
  }

  const ip = clientIp(req);

  // 1) التحقق من الـ PIN (خادم فقط، بمقارنة ثابتة الزمن).
  if (!pinsMatch(pin, ADMIN_PIN)) {
    const failures = await countFailure(ip);
    if (failures >= RATE_LIMIT_MAX_FAILURES) {
      return respond({ ok: false, code: 'rate_limited', error: 'Too many attempts' }, 429, corsOrigin, {
        'Retry-After': String(RATE_LIMIT_WINDOW_MS / 1000),
      });
    }
    return respond({ ok: false, code: 'invalid_pin', error: 'Invalid PIN' }, 401, corsOrigin);
  }

  // 2) إنشاء جلسة حقيقية بحساب الإدارة من Secrets (لا شيء من العميل).
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (authError || !authData.session) {
    const failures = await countFailure(ip);
    if (failures >= RATE_LIMIT_MAX_FAILURES) {
      return respond({ ok: false, code: 'rate_limited', error: 'Too many attempts' }, 429, corsOrigin, {
        'Retry-After': String(RATE_LIMIT_WINDOW_MS / 1000),
      });
    }
    return respond({ ok: false, code: 'server_error', error: 'Login failed' }, 500, corsOrigin);
  }

  const session = authData.session;

  // 3) تأكيد أن الحساب Admin بالمعرّف (وليس بالبريد).
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') {
    // Best-effort: إبطال الجلسة المؤقتة إن أمكن (التوكنات لن تصل للعميل أصلاً).
    try {
      const adminAuth = adminClient.auth.admin as { signOut?: (userId: string) => Promise<unknown> } | undefined;
      if (typeof adminAuth?.signOut === 'function') await adminAuth.signOut(session.user.id);
    } catch {
      // تجاهل — محاولة إضافية فقط.
    }
    const failures = await countFailure(ip);
    if (failures >= RATE_LIMIT_MAX_FAILURES) {
      return respond({ ok: false, code: 'rate_limited', error: 'Too many attempts' }, 429, corsOrigin, {
        'Retry-After': String(RATE_LIMIT_WINDOW_MS / 1000),
      });
    }
    return respond({ ok: false, code: 'server_error', error: 'Login failed' }, 500, corsOrigin);
  }

  // 4) النجاح — إعادة التوكنات فقط (لا كلمة مرور، لا PIN، لا service_role).
  const enrollmentToken = await issuePasskeyEnrollmentAuthorization(session.user.id);

  return respond(
    {
      ok: true,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      ...(enrollmentToken ? { enrollment_token: enrollmentToken } : {}),
    },
    200,
    corsOrigin,
  );
});
