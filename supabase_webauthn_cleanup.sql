-- WISAL WebAuthn / Passkey cleanup.
-- Review this file and run it manually in the Supabase SQL Editor only after
-- confirming these tables are dedicated exclusively to the retired passkey flow.
-- RESTRICT is intentional: shared dependencies must stop the cleanup instead
-- of being removed implicitly.

DROP TABLE IF EXISTS public.admin_webauthn_challenges RESTRICT;
DROP TABLE IF EXISTS public.admin_webauthn_enrollment_authorizations RESTRICT;
DROP TABLE IF EXISTS public.admin_webauthn_credentials RESTRICT;
