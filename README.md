# OPC

Tools for the one-person unicorn — the solopreneur.

OPC's first product is **OPC Console**: a web cockpit that sits *above* your tools
and answers two questions — *what is the state of my whole business right now?* and
*what needs me (or my AI agents) today?* It aggregates attention and decisions
instead of being one more app to do a job in.

Guiding questions for the project:

- **What tools does a solopreneur need?** — see [`docs/一人公司工具调研.md`](docs/一人公司工具调研.md)
- **How does a one-person unicorn make money?**

---

## OPC Console

A multi-tenant web app. Cost is the hard constraint: only free/OSS tooling, no paid
runtime SaaS, and AI is optional (free-tier models + bring-your-own-key) — the
product is fully usable without configuring any AI.

### Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `src/`, TypeScript) |
| UI | Tailwind + shadcn/ui |
| Data + Auth | Supabase (Postgres + Auth + Row Level Security) |
| AI (optional) | Free-tier Gemini Flash / Groq + per-workspace BYOK |
| Deploy target | Cloudflare Pages → `opc.sophontex.com` (see [`DEPLOY.md`](DEPLOY.md)) |

### Data model (5 primitives + supporting tables)

`Business` · `Signal` · `Task` · `Obligation` · `Decision`, plus
`workspaces` / `workspace_members` (tenant boundary, RLS-enforced),
`workspace_settings` (BYOK AI keys), `briefs`, `agents`, `agent_runs`.
Schema lives in [`supabase/migrations/`](supabase/migrations/).

### Features (by build phase)

- **Phase 1 — Manual cockpit** (zero integrations):
  - `/today` — aggregated cockpit: due/overdue tasks, upcoming obligations, new signals
  - `/tasks` — task CRUD (status, due date, priority)
  - `/obligations` — recurring compliance/renewals with lead-time reminders
  - `/decisions` — lightweight decision log
  - `/capture` — universal quick-capture → signals (convertible to tasks)
- **Phase 2 — Inbound signals** (degrade safely when keys absent):
  - `POST /api/ingest/[source]` — generic webhook → signal (shared-secret auth)
  - `POST /api/webhooks/stripe` — Stripe events → signal (hand-written HMAC verify, no SDK)
  - `POST /api/ingest/email` — email-in (Cloudflare Email Routing / forwarder) → signal
  - `/metrics` — read-only business numbers (optional live Stripe balance)
- **Phase 3 — AI layer** (off by default):
  - `/settings` — choose AI provider + BYOK key per workspace
  - `/briefs` + `GET /api/cron/daily-brief` — AI daily brief from the day's signals/tasks/obligations
  - `/agents` — define & run "digital employees" (logged to `agent_runs`)

---

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase values (see below)
npm run dev                  # http://localhost:3000
npm run build                # production build
npm run lint
```

`next build` passes with the placeholder env in `.env.example`; you only need real
Supabase values to log in and persist data.

### Required setup (you must do this — agents have no credentials)

1. **Create a Supabase project**, then apply the schema:
   ```bash
   supabase link --project-ref <ref>
   supabase db push        # runs supabase/migrations/*.sql
   ```
   The migration creates all tables, RLS policies, and a trigger that provisions a
   workspace + owner membership on each new signup.
2. **Fill `.env.local`** with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (see `.env.example` for the full list).
3. **Deploy** to Cloudflare Pages and bind `opc.sophontex.com` — see [`DEPLOY.md`](DEPLOY.md).
4. *(Optional)* Wire Stripe webhook, email-in, cron secret, and AI BYOK keys — all
   off by default; the app runs without them.

## Cost

Everything is on free tiers that allow commercial use; the only fixed cost would be a
domain, and `opc.sophontex.com` is a subdomain of an already-owned domain — so the
baseline recurring cost is effectively **$0**. AI never bills the operator: it uses
free-tier models or each user's own key.

## Status

Phases 0–3 are scaffolded and build cleanly (`next build` ✓, `npm run lint` ✓).
Phase 4 (billing, team collaboration, China tax stack) is intentionally deferred until
the manual cockpit proves its value in daily dogfooding.
