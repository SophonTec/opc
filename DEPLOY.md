# Deploying OPC Console

OPC Console is a Next.js (App Router) app backed by Supabase. The build of
record is `npm run build` (standard Next.js). The production target is
**Cloudflare Pages** at **opc.sophontex.com**, served through the OpenNext
Cloudflare adapter. Everything below uses free / OSS tooling only.

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

## 3. Cloudflare Pages (production)

Cloudflare Pages runs Next.js on the edge via the OpenNext Cloudflare adapter.

1. Add the adapter (kept out of Phase 0 to keep the base build clean):
   ```bash
   npm install --save-dev @opennextjs/cloudflare wrangler
   ```
2. Add a `wrangler.toml` (or `wrangler.jsonc`) with `nodejs_compat` enabled and
   a `pages_build_output_dir` pointing at the adapter output, e.g.:
   ```toml
   name = "opc-console"
   compatibility_date = "2025-01-01"
   compatibility_flags = ["nodejs_compat"]
   pages_build_output_dir = ".open-next/assets"
   ```
3. Add build/deploy scripts to `package.json`:
   ```jsonc
   "scripts": {
     "cf:build": "opennextjs-cloudflare build",
     "cf:deploy": "opennextjs-cloudflare deploy"
   }
   ```
4. In the **Cloudflare dashboard → Workers & Pages → Create → Pages**, connect
   the Git repo. Set:
   - **Build command:** `npx opennextjs-cloudflare build`
   - **Build output directory:** `.open-next/assets`
5. **Environment variables** (Pages → Settings → Environment variables) — add
   the same keys as `.env.example` for Production (and Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (encrypt / mark secret)
   - Optional later: `AI_PROVIDER`, `GEMINI_API_KEY`, `GROQ_API_KEY`,
     `INGEST_SECRET`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`.

> Note: Phase 0 does not require the Cloudflare build to pass. The base
> `next build` is the gate. Wire up the adapter when you actually deploy.

---

## 4. Custom domain — opc.sophontex.com

1. In the Pages project → **Custom domains → Set up a custom domain**, enter
   `opc.sophontex.com`.
2. If `sophontex.com` is on Cloudflare DNS, the `CNAME` is added automatically;
   otherwise add a `CNAME` for `opc` pointing at the `*.pages.dev` target.
3. Wait for the certificate to issue (automatic, free).
4. Set `NEXT_PUBLIC_SITE_URL=https://opc.sophontex.com` and ensure that URL is
   in Supabase Auth → URL Configuration.

---

## 5. Post-deploy checklist

- [ ] `supabase db push` applied — 11 tables exist, RLS enabled.
- [ ] Sign up with a test email → a workspace + settings row appear.
- [ ] All env vars set in Cloudflare Pages (Production + Preview).
- [ ] `https://opc.sophontex.com` resolves and login works.
