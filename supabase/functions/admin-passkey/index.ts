/**
 * WISAL admin WebAuthn / Windows Hello bridge.
 *
 * This function never receives or stores biometric material. It only stores
 * WebAuthn public-key metadata and verifies signed challenges server-side.
 * The returned Supabase session is minted only after the credential belongs to
 * a profile whose role is currently `admin`.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from 'npm:@simplewebauthn/server@13.2.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') ?? '';
const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD') ?? '';
const RP_ID = Deno.env.get('WEBAUTHN_RP_ID') ?? '';
const RP_NAME = Deno.env.get('WEBAUTHN_RP_NAME') ?? 'WISAL';
const EXPECTED_ORIGINS = (Deno.env.get('WEBAUTHN_ORIGINS') ?? '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);
const CHALLENGE_TTL_MS = 2 * 60 * 1000;

const DEFAULT_CORS_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'capacitor://localhost',
  'https://localhost',
]);

type ChallengePurpose = 'registration' | 'authentication';

function getCorsOrigin(req: Request): string | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;
  const allowed = new Set(DEFAULT_CORS_ORIGINS);
  for (const item of (Deno.env.get('CORS_ORIGINS') ?? '').split(',')) {
    const value = item.trim();
    if (value) allowed.add(value);
  }
  return allowed.has(origin) ? origin : null;
}

function respond(body: unknown, status: number, corsOrigin: string | null): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (corsOrigin) {
    headers['Access-Control-Allow-Origin'] = corsOrigin;
    headers['Vary'] = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function isConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY && ADMIN_EMAIL && ADMIN_PASSWORD && RP_ID && EXPECTED_ORIGINS.length > 0);
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function bytesToBase64Url(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

async function getBearerUser(req: Request) {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const client = serviceClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function isAdminUser(userId: string): Promise<boolean> {
  const { data, error } = await serviceClient()
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return !error && data?.role === 'admin';
}

async function requireAdmin(req: Request) {
  const user = await getBearerUser(req);
  if (!user || !(await isAdminUser(user.id))) return null;
  return user;
}

function clientDataChallenge(credential: any): string | null {
  const encoded = credential?.response?.clientDataJSON;
  if (typeof encoded !== 'string') return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded))) as { challenge?: unknown };
    return typeof data.challenge === 'string' && data.challenge.length > 0 ? data.challenge : null;
  } catch {
    return null;
  }
}

async function enrollmentAuthorization(userId: string, rawToken: unknown) {
  if (typeof rawToken !== 'string' || rawToken.length < 32 || rawToken.length > 256) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken));
  const tokenHash = bytesToBase64Url(new Uint8Array(digest));
  const { data, error } = await serviceClient()
    .from('admin_webauthn_enrollment_authorizations')
    .select('id, user_id, expires_at, used_at')
    .eq('token_hash', tokenHash)
    .eq('user_id', userId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error || !data || data.user_id !== userId) return null;
  return data as { id: string; user_id: string; expires_at: string; used_at: string | null };
}

async function consumeEnrollmentAuthorization(id: string, userId: string): Promise<boolean> {
  const { data, error } = await serviceClient()
    .from('admin_webauthn_enrollment_authorizations')
    .update({ used_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('id');
  return !error && data?.length === 1;
}

async function rememberChallenge(
  challenge: string,
  purpose: ChallengePurpose,
  userId: string | null,
  enrollmentAuthorizationId: string | null = null,
) {
  const { error } = await serviceClient().from('admin_webauthn_challenges').insert({
    challenge,
    purpose,
    user_id: userId,
    enrollment_authorization_id: enrollmentAuthorizationId,
    expires_at: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
  });
  return !error;
}

async function consumeChallenge(
  purpose: ChallengePurpose,
  userId: string | null,
  challenge: string,
  enrollmentAuthorizationId: string | null = null,
) {
  let query = serviceClient()
    .from('admin_webauthn_challenges')
    .select('id, challenge')
    .eq('purpose', purpose)
    .eq('challenge', challenge)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .limit(1);
  query = userId === null ? query.is('user_id', null) : query.eq('user_id', userId);
  query = enrollmentAuthorizationId === null
    ? query.is('enrollment_authorization_id', null)
    : query.eq('enrollment_authorization_id', enrollmentAuthorizationId);
  const { data: rows, error } = await query;
  const row = rows?.[0] as { id: string; challenge: string } | undefined;
  if (error || !row) return null;

  const { data: consumed, error: consumeError } = await serviceClient()
    .from('admin_webauthn_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id)
    .is('consumed_at', null)
    .select('id');
  if (consumeError || !consumed?.length) return null;
  return row.challenge;
}

async function issueAdminSession() {
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anonClient.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (error || !data.session || !(await isAdminUser(data.session.user.id))) return null;
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

function credentialFromRow(row: { credential_id: string; public_key: string; sign_count: number; transports: string[] | null }) {
  return {
    id: row.credential_id,
    publicKey: base64UrlToBytes(row.public_key),
    counter: Number(row.sign_count),
    transports: row.transports ?? undefined,
  };
}

function responseBody(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' ? value as Record<string, any> : null;
}

Deno.serve(async req => {
  const corsOrigin = getCorsOrigin(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsOrigin ? {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      } : undefined,
    });
  }
  if (req.method !== 'POST') return respond({ ok: false, code: 'method_not_allowed' }, 405, corsOrigin);
  if (!isConfigured()) return respond({ ok: false, code: 'passkey_not_configured' }, 503, corsOrigin);

  let body: Record<string, any> | null = null;
  try { body = responseBody(await req.json()); } catch { return respond({ ok: false, code: 'bad_request' }, 400, corsOrigin); }
  const action = body?.action;

  try {
    if (action === 'authentication-options') {
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        timeout: 60000,
        userVerification: 'required',
      });
      if (!(await rememberChallenge(options.challenge, 'authentication', null))) return respond({ ok: false, code: 'server_error' }, 500, corsOrigin);
      return respond(options, 200, corsOrigin);
    }

    if (action === 'registration-options') {
      const user = await requireAdmin(req);
      if (!user) return respond({ ok: false, code: 'not_admin' }, 403, corsOrigin);
      const enrollment = await enrollmentAuthorization(user.id, body?.enrollment_token);
      if (!enrollment) return respond({ ok: false, code: 'enrollment_not_authorized' }, 403, corsOrigin);
      const { data: existing } = await serviceClient()
        .from('admin_webauthn_credentials')
        .select('credential_id, transports')
        .eq('user_id', user.id);
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: new TextEncoder().encode(user.id),
        userName: user.email ?? user.id,
        timeout: 60000,
        attestationType: 'none',
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'required',
          userVerification: 'required',
        },
        excludeCredentials: (existing ?? []).map(row => ({
          id: row.credential_id,
          type: 'public-key' as const,
          transports: row.transports ?? undefined,
        })),
      });
      if (!(await rememberChallenge(options.challenge, 'registration', user.id, enrollment.id))) return respond({ ok: false, code: 'server_error' }, 500, corsOrigin);
      return respond(options, 200, corsOrigin);
    }

    if (action === 'registration-verify') {
      const user = await requireAdmin(req);
      if (!user || !body?.credential) return respond({ ok: false, code: 'not_admin' }, 403, corsOrigin);
      const enrollment = await enrollmentAuthorization(user.id, body?.enrollment_token);
      if (!enrollment) return respond({ ok: false, code: 'enrollment_not_authorized' }, 403, corsOrigin);
      const presentedChallenge = clientDataChallenge(body.credential);
      if (!presentedChallenge) return respond({ ok: false, code: 'challenge_invalid' }, 400, corsOrigin);
      const challenge = await consumeChallenge('registration', user.id, presentedChallenge, enrollment.id);
      if (!challenge) return respond({ ok: false, code: 'challenge_invalid' }, 400, corsOrigin);
      const verification = await verifyRegistrationResponse({
        response: body.credential,
        expectedChallenge: challenge,
        expectedOrigin: EXPECTED_ORIGINS,
        expectedRPID: RP_ID,
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo) return respond({ ok: false, code: 'webauthn_failed' }, 400, corsOrigin);
      if (!(await consumeEnrollmentAuthorization(enrollment.id, user.id))) return respond({ ok: false, code: 'enrollment_replay' }, 409, corsOrigin);
      const credential = verification.registrationInfo.credential;
      const { error } = await serviceClient().from('admin_webauthn_credentials').insert({
        user_id: user.id,
        credential_id: credential.id,
        public_key: bytesToBase64Url(credential.publicKey),
        sign_count: credential.counter,
        transports: body.credential.response.transports ?? null,
      });
      if (error) return respond({ ok: false, code: error.code === '23505' ? 'passkey_already_registered' : 'server_error' }, 400, corsOrigin);
      return respond({ ok: true }, 200, corsOrigin);
    }

    if (action === 'authentication-verify') {
      const credentialPayload = body?.credential;
      const credentialId = typeof credentialPayload?.id === 'string' ? credentialPayload.id : '';
      if (!credentialId) return respond({ ok: false, code: 'passkey_not_registered' }, 401, corsOrigin);
      const presentedChallenge = clientDataChallenge(credentialPayload);
      if (!presentedChallenge) return respond({ ok: false, code: 'challenge_invalid' }, 400, corsOrigin);
      const challenge = await consumeChallenge('authentication', null, presentedChallenge);
      if (!challenge) return respond({ ok: false, code: 'challenge_invalid' }, 400, corsOrigin);
      const { data: row, error: rowError } = await serviceClient()
        .from('admin_webauthn_credentials')
        .select('id, user_id, credential_id, public_key, sign_count, transports')
        .eq('credential_id', credentialId)
        .maybeSingle();
      if (rowError || !row || !(await isAdminUser(row.user_id))) return respond({ ok: false, code: 'passkey_not_registered' }, 401, corsOrigin);
      const verification = await verifyAuthenticationResponse({
        response: credentialPayload,
        expectedChallenge: challenge,
        expectedOrigin: EXPECTED_ORIGINS,
        expectedRPID: RP_ID,
        credential: credentialFromRow(row),
        requireUserVerification: true,
      });
      if (!verification.verified) return respond({ ok: false, code: 'webauthn_failed' }, 401, corsOrigin);
      const { data: updated, error: updateError } = await serviceClient()
        .from('admin_webauthn_credentials')
        .update({ sign_count: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('sign_count', row.sign_count)
        .select('id');
      if (updateError || !updated?.length) return respond({ ok: false, code: 'webauthn_replay' }, 409, corsOrigin);
      const session = await issueAdminSession();
      if (!session) return respond({ ok: false, code: 'server_error' }, 500, corsOrigin);
      return respond({ ok: true, ...session }, 200, corsOrigin);
    }

    return respond({ ok: false, code: 'bad_request' }, 400, corsOrigin);
  } catch (error) {
    console.error('[admin-passkey] WebAuthn operation failed:', error);
    return respond({ ok: false, code: 'webauthn_failed' }, 400, corsOrigin);
  }
});
