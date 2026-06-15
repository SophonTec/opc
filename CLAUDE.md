# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**OPC Console** — a multi-tenant web cockpit for the *one-person unicorn / solopreneur*
(use this wording, not "one-person company"). It sits *above* a solo operator's tools and
answers "what is the state of my whole business?" and "what needs me today?". It aggregates
attention and decisions; it is **not** a replacement for any single tool.

Product/competitive context lives in `docs/一人公司工具调研.md`. `README.md` has the feature list.

## Hard constraints (these shape design decisions)

- **Cost minimized to ~$0.** Free/OSS tooling only; no paid runtime SaaS dependency.
- **AI is optional and never bills the operator.** Default to free-tier models (Gemini Flash / Groq)
  or per-workspace BYOK keys. **Every feature must work fully with no AI configured** — degrade, never crash.
- **Deploy target: Cloudflare Workers via OpenNext → `opc.sophontex.com`** (see `DEPLOY.md`; configured in
  `wrangler.jsonc` + `open-next.config.ts`, `npm run cf:build`). The build of record is plain `next build`;
  the Cloudflare adapter is a deploy concern, not a build gate.
- TypeScript only — do not introduce a second language/runtime.

## Commands

```bash
npm run dev      # Next.js dev server (Turbopack) on http://localhost:3000
npm run build    # production build — the canonical correctness gate
npm run lint     # eslint (eslint-config-next)
supabase db push # apply supabase/migrations/*.sql to the linked project
```

- **No test framework is configured yet** — there is no `test` script and no test files. Verification is
  `next build` + `npm run lint` + manual/browser checks. Don't look for a test runner.
- `next build` and `next dev` **succeed with the placeholder values in `.env.local`** (Supabase clients are
  lazy, see below). You only need real Supabase credentials to actually log in and persist data.

## Architecture

Next.js 16 (App Router, `src/`) · React 19 · Tailwind v4 + shadcn/ui (Base UI + Radix primitives) ·
Supabase (Postgres + Auth + RLS) · `react-hook-form` + `zod`.

### Multi-tenancy is the core invariant
`workspace` is the tenant boundary. Every business table carries a `workspace_id`, and **Postgres RLS**
restricts rows to `workspace_id IN (select workspace_id from workspace_members where user_id = auth.uid())`.
A user gets exactly one workspace at signup. Resolve it server-side with `getCurrentWorkspaceId()`
(`src/lib/auth.ts`, React-`cache`d per request).

### Two Supabase clients — pick the right one
- **`src/lib/supabase/server.ts` → `createClient()`** — cookie-bound, runs as the logged-in user, **RLS applies**.
  Use this in Server Components, Server Actions, and most route handlers. This is the default.
- **`src/app/api/ingest/admin.ts` → `getAdminClient()`** — service-role key, **bypasses RLS**. Server-only,
  for trusted inbound writes (webhooks/cron) where there is no user session. Returns `null` when
  `SUPABASE_SERVICE_ROLE_KEY` is absent; callers must respond `503`. Never import from browser code.

### Feature convention
Each feature is a folder `src/app/(app)/<feature>/` with `page.tsx`, a `"use server"` `actions.ts`,
and `*-client.tsx` client components. Server actions follow the pattern in `src/app/(app)/tasks/actions.ts`:
`requireWorkspace()` → mutate via the cookie client with **both** `.eq("workspace_id", …)` and RLS
(defense in depth) → `revalidatePath()`. Auth pages live in `src/app/(auth)/`.

### Auth + provisioning
`src/middleware.ts` (refreshes the session and gates the `(app)` group) delegates to
`src/lib/supabase/middleware.ts`. On signup, a Postgres trigger `handle_new_user` (in the initial
migration) auto-creates the user's `workspace`, `workspace_members` row, and `workspace_settings` row —
do not duplicate this in app code.

### Data model
11 tables in `supabase/migrations/0001_init.sql`: `workspaces`, `workspace_members`, `businesses`,
`signals`, `tasks`, `obligations`, `decisions`, `workspace_settings`, `briefs`, `agents`, `agent_runs`.
Schema changes go in a **new** numbered migration (see `0002_briefs_unique.sql`) — never edit `0001`.

### AI layer (`src/lib/ai/`)
Single entry point `complete({ system, prompt, model })` from `@/lib/ai`. Provider/key resolution:
`workspace_settings` (BYOK) → env (`AI_PROVIDER` + `GEMINI_API_KEY`/`GROQ_API_KEY`) → `"none"`.
Callers must check `result.ok` and degrade when AI is unconfigured. Providers use plain `fetch`, no SDKs.
The daily brief cron (`src/app/api/cron/daily-brief/route.ts`) only processes workspaces with AI configured.

## Gotchas

- **The `Database` type in `src/lib/types.ts` is fully inlined** (explicit `Row`/`Insert`/`Update` per table).
  Do not refactor it into a generic `TableShape<Row>` alias — `@supabase/supabase-js` v2 collapses aliased
  table types to `never` inside `.from()`, which breaks every `.insert()`/typed query. Narrow status columns
  to their literal unions so DB rows stay assignable to the app's `Task`/`Signal` interfaces.
- **Supabase clients are lazy and fall back to placeholders** — that is what lets `next build` pass without
  real env. Keep it that way; never throw at import time on missing env.
- **`next build` fetches Google Fonts** (`next/font/google` Geist) at build time, so the build needs network.
  Migrating to `next/font/local` would make builds offline/deterministic.
- **Next.js 16 deprecation:** `src/middleware.ts` should eventually be renamed to the `proxy` convention
  (build prints a warning; non-blocking).
- `SUPABASE_SERVICE_ROLE_KEY` is only needed for ingest endpoints and the cron brief — the core
  login/cockpit/CRUD loop runs on the anon key alone.

## Environment

See `.env.example` for the full list. Only `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
are needed to run the app; `SUPABASE_SERVICE_ROLE_KEY` (server-only secret) and all
AI/Stripe/ingest/cron vars are optional and gated to their features.
