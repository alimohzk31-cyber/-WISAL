-- WISAL Admin WebAuthn / Windows Hello metadata.
-- REVIEW / DEPLOYMENT REQUIRED: this file is intentionally not executed by Codex.
-- It stores public-key metadata only. It never stores a fingerprint, template,
-- biometric image, Windows Hello secret, or private key.

CREATE TABLE IF NOT EXISTS public.admin_webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  sign_count bigint NOT NULL DEFAULT 0,
  transports text[] NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS admin_webauthn_credentials_user_id_idx
  ON public.admin_webauthn_credentials(user_id);

CREATE TABLE IF NOT EXISTS public.admin_webauthn_enrollment_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_webauthn_enrollment_authorizations_lookup_idx
  ON public.admin_webauthn_enrollment_authorizations(user_id, expires_at, used_at, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('registration', 'authentication')),
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  enrollment_authorization_id uuid NULL REFERENCES public.admin_webauthn_enrollment_authorizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_webauthn_challenges
  ADD COLUMN IF NOT EXISTS enrollment_authorization_id uuid NULL REFERENCES public.admin_webauthn_enrollment_authorizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS admin_webauthn_challenges_lookup_idx
  ON public.admin_webauthn_challenges(purpose, user_id, enrollment_authorization_id, challenge, expires_at, consumed_at, created_at DESC);

ALTER TABLE public.admin_webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_webauthn_enrollment_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- The browser never reads or writes these tables directly. The admin-passkey
-- Edge Function uses service_role after validating the bearer session/role.
REVOKE ALL ON TABLE public.admin_webauthn_credentials FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_webauthn_enrollment_authorizations FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_webauthn_challenges FROM anon, authenticated;
