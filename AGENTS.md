<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- CODEX-PRODUCT-FOUNDATION:START -->
# Project Agent Rules

Read the relevant `docs/` files before changing product UI or shared architecture.

- Understand the affected journey, users, roles, permissions, data contracts, and downstream impact before coding.
- Diagnose root causes before UI workarounds. Preserve business logic unless explicitly asked to change it.
- Search and reuse existing tokens, components, patterns, validation, and domain logic before creating alternatives.
- Keep work mobile-first; verify RTL/LTR where supported or plausible using logical layout properties.
- Do not add arbitrary visual values, duplicate patterns, decorative clutter, generic AI-looking UI, or unnecessary dependencies.
- Cover loading, empty, error, partial, stale, disabled, validation, success, and permission states.
- Preserve semantics, keyboard access, focus, contrast, accessible names, touch targets, and reduced motion.
- Review performance, query/caching behavior, asset weight, render cost, and cross-screen regressions.
- Record durable decisions in `docs/`. Do not mass-redesign.
- Completion requires targeted tests and rendered visual QA across mobile, tablet, laptop, and desktop; compilation alone is insufficient.
<!-- CODEX-PRODUCT-FOUNDATION:END -->

## Cursor Cloud specific instructions

Velora is a single Next.js 16 app (POS + light ERP) backed by a **local Supabase stack** (Postgres + Auth + RLS + Storage) run via Docker. There is one product/service to run: the Next dev server (`npm run dev`, port 3000) plus Supabase. Standard scripts live in `package.json`/`README.md`; only the non-obvious caveats are below.

### Starting services (no systemd in this VM)
The update script only refreshes npm deps (`npm ci`). Docker + the Supabase CLI are already installed but nothing auto-starts, so start them manually each session:

1. Start the Docker daemon (systemd is unavailable):
   `sudo dockerd > /tmp/dockerd.log 2>&1 &` then `sudo chmod 666 /var/run/docker.sock`
   The daemon is configured for `fuse-overlayfs` with `containerd-snapshotter=false` (required on this kernel — see `/etc/docker/daemon.json`); iptables is set to `iptables-legacy`.
2. Start Supabase: `supabase start` (API `54321`, DB `54322`, Studio `54323`). The DB container is `supabase_db_SweetFlow-pos`.
3. Start the app: `npm run dev` (http://localhost:3000).

The Supabase Docker volume persists DB state (migrations, seed, grants, auth users) across container restarts, so after a reboot you usually only need to restart the containers — not re-seed. Steps under "Post-`db reset`" below are only needed after a fresh init or `supabase db reset`.

### `.env.local` (gitignored — recreate if missing)
Required for the app + `db:seed-auth`. Use the standard local Supabase keys (get exact values from `supabase status`):
`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>`, `SUPABASE_SERVICE_ROLE_KEY=<service_role key>` (must be the JWT `service_role` key, not the `sb_secret_…` one — `seed-auth.mjs` validates the `role` claim), plus `VELORA_COOKIE_SECRET=<32+ char random>`. Optional: `NEXT_PUBLIC_APP_URL=http://localhost:3000`, `PLATFORM_BOOTSTRAP_EMAILS=owner@CafeFlow.local` (unlocks `/platform`).

### Post-`db reset` / fresh-init caveat: DB grants (REQUIRED)
The local `supabase/postgres` image applies restricted default privileges: tables created by the `postgres` role during migrations grant only `TRUNCATE/REFERENCES/TRIGGER` (no DML) to `anon/authenticated/service_role`. As a result `npm run db:seed-auth` fails with `permission denied for table users`, and the app cannot read/write any data. After every `supabase db reset` (or the very first `supabase start`), re-apply the standard grants, then seed:
```
bash scripts/dev-grant-api-roles.sh
npm run db:seed-auth
```
Do not edit migrations/`seed.sql` for this — it is a local-image quirk (hosted Supabase grants these by default). Demo login: `owner@CafeFlow.local` / `demo1234` (see `docs/DEMO_USERS.md`).

### Lint caveat
`supabase start` writes a minified edge-runtime file under `supabase/.temp/start-secrets/**`. ESLint (flat config) lints it and reports ~154 false `prefer-const` errors, and it does not honor `.gitignore`. Remove it before linting (or lint before starting Supabase): `rm -rf supabase/.temp/start-secrets`. On a clean tree `npm run lint` passes (only 2 warnings).

### Tests
Run targeted tests for the changed area and `npx tsc --noEmit`. Do not assume historical test counts are current.
