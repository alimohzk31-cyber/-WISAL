# WISAL admin authorization: parallel phase 1

## Boundary

Live authorization stays `public.profiles.role = 'admin'` through the unchanged
`public.is_admin()`, published `admin-login` v11, existing RLS, and profile-role guard.
`private.admin_users` is a shadow source only: no app imports, new public RPC,
synchronization trigger, Auth changes, PIN changes, or Edge deployment.

## Preflight evidence

`20260927105000_admin_users_shadow.before.json` records the actual remote function
definitions, profiles policies, profile triggers, existing-policy hash, masked admin
UUID and exact-match SHA-256 fingerprint, and local protected-file hashes.
There was exactly one live admin and eight non-admin profiles at preflight.
The `private` schema and any migration-history table were absent.
PostgREST exposes `public,graphql_public`, not `private`.

## New objects and safety

- `private` schema, owned by postgres and not exposed through the Data API.
- `private.admin_users(user_id uuid primary key, active boolean not null default false,
  created_at timestamptz not null default now())`, owned by postgres.
- Foreign key to `auth.users(id)`, ON DELETE/UPDATE RESTRICT. Deleting this protected
  account now requires deliberately addressing its shadow membership first; no
  account or profile is changed by this migration.
- No profile FK or copied profile fields. Exactly the pinned existing administrator
  is inserted with `active=true`; no first-user bootstrap.
- Schema/table privileges revoked from PUBLIC, anon, authenticated, service_role.
  RLS enabled and forced, no policies: default deny. Only trusted maintenance access.
- Identity, protected-function and policy drift abort the transaction. An already
  existing private schema also aborts; this is not a blindly rerunnable migration.
- Comparisons disclose booleans/counts only; no real PIN or session is needed.

## Application

Apply ONLY `../migrations/20260927105000_admin_users_shadow.sql` to the reviewed
project `nnxrjpitjxtceydlcxzm` as postgres, in its explicit transaction.
Do not replay legacy SQL and do not run a broad CLI db push/pull/reset.
The intended execution uses the existing management credential in memory with
the Management API query endpoint; no login-role initialization or new secret.
The API request must explicitly permit this reviewed write transaction.

The preflight found no `supabase_migrations.schema_migrations` ledger. This phase
does not create an extra ledger table. If applied via the query API, record the exact
file hash and outcome in the audit result. Reconcile migration history in a separately
approved operation before introducing a CLI migration workflow; do not replay it.

## Verification

Run `20260927105000_admin_users_shadow.verify.sql` as postgres. It starts a READ ONLY
transaction, asserts protected objects and the admin profile are unchanged, checks
ACL/RLS and old/new decisions for all existing accounts, and calls the real
`is_admin()` with transaction-local identity context. It neither creates sessions
nor updates any user. It deliberately grants no special audit access to the table.

Compare published admin-login version/source and exposed schemas before/after.
Run `npm run test`, `npm run lint` (tsc --noEmit), and `npm run build`.
The nine existing browser checks use real frontend auth components with an isolated
synthetic Supabase SDK; they are not a live PIN login. Do not supply real secrets.
The known Windows Chrome sandbox timeout requires running the unchanged browser
test command outside the restricted agent sandbox, not disabling Chrome security.

If any assertion/test fails: STOP, report the failure, and do not switch authority.

## Rollback (prepared, not automatically executed)

After explicit approval, run ONLY
`../rollbacks/20260927105000_admin_users_shadow.sql`.
It checks unchanged live helper definitions, the original one-member shadow state,
the table marker, and absence of new function/policy references. It drops only the
new table and the phase-1 schema in one transaction with RESTRICT, never CASCADE.
If another object now exists in private, or authority has been switched, it refuses
rather than deleting later work. FK triggers belonging to the new table disappear
with that table; existing application triggers remain.
No auth.users/profile rows, live policies, existing functions, or secrets are removed.

Stop after phase 1. Any switch of is_admin/admin-login requires separate approval.
