# WISAL admin passkey deployment

The browser integration is intentionally not sufficient by itself. Before Windows Hello login can be enabled in a deployed environment, an administrator must:

1. Review and run `supabase_add_admin_webauthn.sql` against the intended Supabase project.
2. Deploy this function, for example:

   ```sh
   supabase functions deploy admin-passkey --no-verify-jwt
   ```

   The function performs its own bearer-session and admin-role checks for every operation, requires the short-lived server-issued enrollment authorization for registration, and performs signed WebAuthn verification for authentication.
3. Configure Edge Function secrets without putting them in the frontend:

   - `WEBAUTHN_RP_ID`: the exact host used by the web app, such as `admin.example.com` (no scheme or port).
   - `WEBAUTHN_RP_NAME`: a display name such as `WISAL`.
   - `WEBAUTHN_ORIGINS`: comma-separated exact browser origins, such as `https://admin.example.com`.
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`: the existing server-side admin account secrets used to mint the same Supabase session as the PIN flow.
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`: Edge Function environment values; the service role remains server-side only.

After a successful PIN login, `supabase/functions/admin-login/index.ts` creates a random five-minute enrollment authorization, stores only its SHA-256 hash bound to the admin user, and returns the raw token only in that response. The frontend keeps that token in memory only. `admin-passkey` requires it for both registration endpoints and consumes it once after successful WebAuthn registration. An old Supabase session without that token cannot enroll a passkey.

The SQL stores only credential IDs, public keys, counters, transports, enrollment-token hashes, and short-lived one-use challenges. It does not store fingerprints, biometric templates, Windows Hello secrets, or private keys. Until the SQL is applied, the function is deployed, and the secrets/origins are configured, the PIN path remains the only usable admin login and live fingerprint login must be reported as not ready.
