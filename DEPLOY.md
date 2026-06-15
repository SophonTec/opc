# Deploying OPC Console

OPC Console is a Next.js (App Router) app backed by Supabase. The build of
record is `npm run build` (standard Next.js). The production target is
**Cloudflare Workers** via the OpenNext adapter (`@opennextjs/cloudflare`), served
at **opc.sophontex.com**. Everything below uses free / OSS tooling only.

> Verified: `npm run cf:build` produces `.open-next/worker.js` with this repo's
> `wrangler.jsonc` + `open-next.config.ts`. The adapter targets Workers (with static
> assets), not the legacy Cloudflare Pages adapter.

---

## 1. Supabase project

1. Create a free project at <https://supabase.com> (Postgres + Auth included).
2. From **Project Settings → API**, copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, secret)
3. Install the Supabase CLI (free):
   ```bash
   npm install -g supabase
   # or: brew install supabase/tap/supabase
   ```
4. Link and push the schema (creates all 11 tables, RLS, and the new-user
   trigger from `supabase/migrations/0001_init.sql`):
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
5. **Auth settings** (Supabase dashboard → Authentication):
   - Enable **Email** provider.
   - For local/dev speed you can turn **off** "Confirm email"; in production
     keep it on (the signup flow already handles the "check your inbox" case).
   - Add `https://opc.sophontex.com` (and `http://localhost:3000` for dev) to
     **URL Configuration → Redirect URLs / Site URL**.

> The `handle_new_user()` trigger provisions a workspace, an owner
> `workspace_members` row, and a `workspace_settings` row on every signup —
> no app-side bootstrapping needed.

---

## 2. Local development

```bash
cp .env.example .env.local   # then fill in real Supabase values
npm install
npm run dev                  # http://localhost:3000
```

`.env.local` ships with placeholder Supabase values so `npm run build`
succeeds with no real credentials. Replace them to actually sign in.

---

## 3. Cloudflare Workers (production)

The adapter is already wired up in this repo: `wrangler.jsonc`, `open-next.config.ts`,
and `cf:*` scripts in `package.json`. Verify the build locally:

```bash
npm run cf:build      # opennextjs-cloudflare build → .open-next/worker.js
npm run cf:preview    # build + run the Worker locally (http://localhost:8788)
```

### Option A — deploy from your machine (simplest)

```bash
npx wrangler login        # one-time, opens browser
npm run cf:deploy         # builds + `wrangler deploy`; creates the `opc-console` Worker
```

- **Build-time vars** — `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  are read from `.env.local` during the build and inlined into the bundle (they are
  public; safe to bake in).
- **Runtime secrets** — set once, read by the Worker at runtime:
  ```bash
  npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
  # optional, per feature you enable:
  npx wrangler secret put GEMINI_API_KEY      # or GROQ_API_KEY
  npx wrangler secret put INGEST_SECRET
  npx wrangler secret put STRIPE_WEBHOOK_SECRET
  npx wrangler secret put STRIPE_WS_ID
  npx wrangler secret put CRON_SECRET
  ```

### Option B — Git-connected builds (CI on push)

Dashboard → **Workers & Pages → Create → Workers → Connect to Git**, pick the repo, then:
- **Build command:** `npx opennextjs-cloudflare build`
- **Deploy command:** `npx wrangler deploy`
- **Variables & Secrets:** add `NEXT_PUBLIC_*` as plaintext build vars; add
  `SUPABASE_SERVICE_ROLE_KEY` and any AI/Stripe/ingest/cron keys as encrypted secrets.

---

## 4. Custom domain — opc.sophontex.com

1. Ensure the `sophontex.com` zone is on **Cloudflare DNS**. If not, add the site to
   Cloudflare first (free) and point the registrar's nameservers at it.
2. Dashboard → **Workers & Pages → `opc-console` → Settings → Domains & Routes → Add →
   Custom domain** → enter `opc.sophontex.com`. Cloudflare adds the record and issues
   the TLS certificate automatically (free).
3. Set `NEXT_PUBLIC_SITE_URL=https://opc.sophontex.com` (build var) and add that URL to
   **Supabase → Authentication → URL Configuration** (Site URL + Redirect URLs).

---

## 5. Post-deploy checklist

- [ ] `supabase db push` applied — 11 tables exist, RLS enabled.
- [ ] `npm run cf:build` succeeds locally — `.open-next/worker.js` produced. ✅ verified
- [ ] Runtime secrets set via `wrangler secret put` (or dashboard).
- [ ] `https://opc.sophontex.com` resolves and login works.
