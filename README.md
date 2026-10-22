# Limitline

Prop firm challenge tracking and account risk monitoring. Next.js (App Router) · TypeScript strict · Tailwind ·
Supabase (Auth + Postgres + RLS) · Vercel.

Limitline works only from values you record. It has no broker or prop-firm connection and does not provide
real-time protection.

## 1. Run locally
```bash
npm install
cp .env.example .env.local     # then fill in the Supabase values
npm run dev                    # http://localhost:3000
```
Requires Node 22.6+ (the unit tests use Node's built-in test runner with type stripping).

## 2. Connect Supabase
1. Create a project at supabase.com.
2. SQL Editor → paste and run `supabase/migrations/0001_init.sql`.
3. Project Settings → API: copy the **Project URL** into `NEXT_PUBLIC_SUPABASE_URL` and the **anon / publishable key** into
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Authentication → URL Configuration: set **Site URL** to your site (local: `http://localhost:3000`, later your Vercel URL)
   and add `<site>/auth/callback` to **Redirect URLs**.
5. Optional, only for "Delete account": put the **service_role** key in `SUPABASE_SERVICE_ROLE_KEY` (server only, never `NEXT_PUBLIC_`).
6. Optional: Authentication → Providers → Email → turn off "Confirm email" while testing.

## 3. Deploy
1. Push this folder to a GitHub repository.
2. vercel.com → Add New Project → import the repo (framework: Next.js, no build changes).
3. Add the environment variables from `.env.example` (set `NEXT_PUBLIC_SITE_URL` to your Vercel URL).
4. Deploy, then update Supabase's Site URL / Redirect URLs to the Vercel URL.

## 4. Checks
```bash
npm run typecheck && npm run lint && npm test && npm run build
```
Cross-user access: run `supabase/tests/rls_cross_user.sql` in the SQL Editor (instructions inside).
Calculation rules: `docs/CALCULATIONS.md`.

## Structure
`src/lib/calculations` pure engine (money, time zones, rules, risk) · `src/lib/validation` Zod schemas ·
`src/features/*/actions.ts` server actions (validate, check ownership, write, audit) · `src/lib/server` session, data loading, alerts ·
`src/components` UI · `supabase/migrations` schema + RLS.
