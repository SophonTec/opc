/**
 * GET /api/cron/daily-brief
 *
 * Triggered by Cloudflare Cron (or any HTTP caller with the secret header).
 * For each workspace that has AI configured, it:
 *   1. Collects today's new signals, open/doing tasks due within 3 days,
 *      and obligations due within their lead_days window.
 *   2. Calls the AI provider to generate a brief.
 *   3. Upserts a row in `briefs` (one per workspace per calendar date).
 *
 * Workspaces without a provider / API key are silently skipped — no error.
 *
 * Auth: expects Authorization header "Bearer <CRON_SECRET>".
 * If CRON_SECRET is unset the endpoint is open (fine for local dev only).
 *
 * Note: uses @supabase/supabase-js createClient directly (service-role bypass)
 * so it can iterate all workspaces without a session cookie.
 */

import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/types"
import { complete } from "@/lib/ai"
import type { AiProvider } from "@/lib/ai"

// ---------------------------------------------------------------------------
// Service-role Supabase client — bypasses RLS for cron tasks
// ---------------------------------------------------------------------------

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "placeholder"
  return createClient<Database>(url, serviceKey)
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  // ── Auth check ─────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET ?? ""
  if (cronSecret) {
    const authHeader = request.headers.get("authorization") ?? ""
    const token = authHeader.replace(/^Bearer\s+/i, "").trim()
    if (token !== cronSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  const supabase = getServiceClient()

  // ── 1. Fetch all workspace_settings ───────────────────────────────────────
  const { data: settingsRows, error: settingsError } = await supabase
    .from("workspace_settings")
    .select("workspace_id, ai_provider, ai_api_key")

  if (settingsError) {
    console.error("[cron/daily-brief] fetch settings:", settingsError.message)
    return Response.json({ error: "DB error" }, { status: 500 })
  }

  if (!settingsRows || settingsRows.length === 0) {
    return Response.json({ ok: true, processed: 0, skipped: 0, date: today })
  }

  let processed = 0
  let skipped = 0

  for (const settings of settingsRows) {
    const { workspace_id, ai_provider, ai_api_key } = settings

    // Skip workspaces without AI configured
    if (!ai_provider || ai_provider === "none" || !ai_api_key) {
      skipped++
      continue
    }

    try {
      const content = await buildBriefForWorkspace({
        supabase,
        workspaceId: workspace_id,
        today,
        provider: ai_provider as AiProvider,
        apiKey: ai_api_key,
      })

      if (content === null) {
        skipped++
        continue
      }

      // Upsert: one brief per workspace per day
      const { error: upsertError } = await supabase
        .from("briefs")
        .upsert(
          { workspace_id, content, for_date: today },
          { onConflict: "workspace_id,for_date", ignoreDuplicates: false }
        )

      if (upsertError) {
        console.error(
          `[cron/daily-brief] upsert workspace ${workspace_id}:`,
          upsertError.message
        )
        skipped++
      } else {
        processed++
      }
    } catch (err) {
      console.error(`[cron/daily-brief] workspace ${workspace_id}:`, err)
      skipped++
    }
  }

  return Response.json({ ok: true, processed, skipped, date: today })
}

// ---------------------------------------------------------------------------
// Per-workspace data collection + AI call
// ---------------------------------------------------------------------------

interface BuildBriefOpts {
  supabase: ReturnType<typeof getServiceClient>
  workspaceId: string
  today: string // YYYY-MM-DD
  provider: AiProvider
  apiKey: string
}

/**
 * Collects workspace data, builds a prompt, calls AI.
 * Returns the generated text or null if AI returned nothing.
 */
async function buildBriefForWorkspace(opts: BuildBriefOpts): Promise<string | null> {
  const { supabase, workspaceId, today, provider, apiKey } = opts
  const todayDate = new Date(today)

  // Signals: new, most recent 20
  const { data: signals } = await supabase
    .from("signals")
    .select("title, source")
    .eq("workspace_id", workspaceId)
    .eq("status", "new")
    .order("created_at", { ascending: false })
    .limit(20)

  // Tasks: open/doing with due_at within next 3 days (or overdue)
  const threeDaysOut = new Date(todayDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, status, due_at")
    .eq("workspace_id", workspaceId)
    .in("status", ["open", "doing"])
    .not("due_at", "is", null)
    .lte("due_at", threeDaysOut)
    .order("due_at", { ascending: true })
    .limit(15)

  // Obligations: all with next_due_at set; filter by lead_days in JS
  const { data: allObligations } = await supabase
    .from("obligations")
    .select("title, kind, next_due_at, lead_days")
    .eq("workspace_id", workspaceId)
    .not("next_due_at", "is", null)
    .order("next_due_at", { ascending: true })
    .limit(30)

  const dueObligations = ((allObligations ?? []) as Array<{
    title: string | null
    kind: string | null
    next_due_at: string | null
    lead_days: number
  }>).filter((o) => {
    if (!o.next_due_at) return false
    const nextDue = new Date(o.next_due_at)
    const leadMs = (o.lead_days ?? 7) * 24 * 60 * 60 * 1000
    return nextDue <= new Date(todayDate.getTime() + leadMs)
  })

  // ── Build prompt ──────────────────────────────────────────────────────────
  const signalLines =
    (signals ?? []).map((s) => `- [${s.source ?? "unknown"}] ${s.title ?? "(no title)"}`).join("\n") ||
    "(none)"

  const taskLines =
    (tasks ?? [])
      .map((t) => `- [${t.status}] ${t.title ?? "(no title)"}${t.due_at ? ` (due ${t.due_at.slice(0, 10)})` : ""}`)
      .join("\n") || "(none)"

  const obligationLines =
    dueObligations
      .map((o) => `- ${o.title ?? "(no title)"}${o.kind ? ` [${o.kind}]` : ""} — due ${o.next_due_at?.slice(0, 10) ?? "?"}`)
      .join("\n") || "(none)"

  const system = `You are an executive assistant writing a concise daily brief for a solo founder.
Be direct, actionable, and focused. Use plain markdown headings.
Do not pad with filler phrases.`

  const prompt = `Today is ${today}. Generate a daily operating brief.

## New Signals (${(signals ?? []).length})
${signalLines}

## Upcoming Tasks
${taskLines}

## Upcoming Obligations
${obligationLines}

Write a brief with:
1. A 2–3 sentence executive summary of the day
2. Top 3 priorities to focus on
3. Any critical deadlines or obligations requiring immediate action

Keep it under 350 words.`

  // Pass workspaceOverride so complete() skips the DB lookup (no session here)
  const result = await complete({ system, prompt }, { provider, key: apiKey })

  if (!result.ok) {
    console.error(`[cron/daily-brief] AI error workspace ${workspaceId}:`, result.message)
    return null
  }

  return result.text
}
