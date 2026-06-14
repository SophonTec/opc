"use server"

import { revalidatePath } from "next/cache"
import { getCurrentWorkspaceId } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { complete } from "@/lib/ai"
import type { AiProvider } from "@/lib/ai"
import type { Brief } from "@/lib/types"

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function getBriefs(): Promise<Brief[]> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("briefs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("for_date", { ascending: false })
    .limit(30)

  if (error) {
    console.error("[briefs/actions] getBriefs:", error.message)
    return []
  }

  return (data ?? []) as Brief[]
}

// ---------------------------------------------------------------------------
// Generate brief on-demand (current workspace, current user session)
// ---------------------------------------------------------------------------

export interface GenerateBriefResult {
  ok: boolean
  message: string
}

export async function generateBriefNow(): Promise<GenerateBriefResult> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) {
    return { ok: false, message: "Not authenticated." }
  }

  const supabase = await createClient()

  // ── AI settings ───────────────────────────────────────────────────────────
  const { data: settings } = await supabase
    .from("workspace_settings")
    .select("ai_provider, ai_api_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  if (!settings?.ai_provider || settings.ai_provider === "none" || !settings?.ai_api_key) {
    return {
      ok: false,
      message: "AI is not configured. Go to Settings to add a provider and API key.",
    }
  }

  const provider = settings.ai_provider as AiProvider
  const apiKey = settings.ai_api_key

  const today = new Date().toISOString().slice(0, 10)
  const todayDate = new Date(today)

  // ── Signals ───────────────────────────────────────────────────────────────
  const { data: signals } = await supabase
    .from("signals")
    .select("title, source")
    .eq("workspace_id", workspaceId)
    .eq("status", "new")
    .order("created_at", { ascending: false })
    .limit(20)

  // ── Tasks: due within 3 days or overdue ──────────────────────────────────
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

  // ── Obligations: filter by per-row lead_days ──────────────────────────────
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

  // Pass workspaceOverride to avoid a second DB round-trip in complete()
  const result = await complete({ system, prompt }, { provider, key: apiKey })

  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
    }
  }

  // ── Upsert brief: one per workspace per day ───────────────────────────────
  const { error: upsertError } = await supabase
    .from("briefs")
    .upsert(
      { workspace_id: workspaceId, content: result.text, for_date: today },
      { onConflict: "workspace_id,for_date", ignoreDuplicates: false }
    )

  if (upsertError) {
    console.error("[briefs/actions] upsert:", upsertError.message)
    return { ok: false, message: "Failed to save brief. Please try again." }
  }

  revalidatePath("/briefs")
  return { ok: true, message: "Today's brief has been generated." }
}
