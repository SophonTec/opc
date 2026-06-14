"use server"

import { revalidatePath } from "next/cache"

import { getCurrentWorkspaceId } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { Agent, AgentRun } from "@/lib/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireWorkspace(): Promise<string> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) throw new Error("Not authenticated")
  return workspaceId
}

// ---------------------------------------------------------------------------
// Agent CRUD
// ---------------------------------------------------------------------------

export async function getAgents(): Promise<Agent[]> {
  const workspaceId = await requireWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Agent[]
}

export async function createAgent(formData: FormData) {
  const workspaceId = await requireWorkspace()
  const supabase = await createClient()

  const name = (formData.get("name") as string | null)?.trim()
  if (!name) throw new Error("Name is required")

  const system_prompt = (formData.get("system_prompt") as string | null)?.trim() || null
  const model = (formData.get("model") as string | null)?.trim() || null

  const { error } = await supabase.from("agents").insert({
    workspace_id: workspaceId,
    name,
    system_prompt,
    model,
  })

  if (error) throw new Error(error.message)
  revalidatePath("/agents")
}

export async function updateAgent(id: string, formData: FormData) {
  const workspaceId = await requireWorkspace()
  const supabase = await createClient()

  const name = (formData.get("name") as string | null)?.trim()
  if (!name) throw new Error("Name is required")

  const system_prompt = (formData.get("system_prompt") as string | null)?.trim() || null
  const model = (formData.get("model") as string | null)?.trim() || null

  const { error } = await supabase
    .from("agents")
    .update({ name, system_prompt, model })
    .eq("id", id)
    .eq("workspace_id", workspaceId)

  if (error) throw new Error(error.message)
  revalidatePath("/agents")
}

export async function deleteAgent(id: string) {
  const workspaceId = await requireWorkspace()
  const supabase = await createClient()

  const { error } = await supabase
    .from("agents")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId)

  if (error) throw new Error(error.message)
  revalidatePath("/agents")
}

// ---------------------------------------------------------------------------
// Agent Runs
// ---------------------------------------------------------------------------

export async function getAgentRuns(agentId: string): Promise<AgentRun[]> {
  const workspaceId = await requireWorkspace()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) throw new Error(error.message)
  return (data ?? []) as AgentRun[]
}

/**
 * Run an agent:
 * 1. Create a pending agent_run row.
 * 2. Look up workspace AI settings and call complete() from src/lib/ai.
 * 3. Update the run row to done/error.
 * 4. Return the run ID so the client can fetch/display the result.
 *
 * Degrades gracefully when AI is not configured: returns a descriptive
 * error message in the run output rather than throwing.
 */
export async function runAgent(
  agentId: string,
  input: string
): Promise<{ runId: string; error?: string }> {
  const workspaceId = await requireWorkspace()
  const supabase = await createClient()

  // Fetch the agent definition
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("workspace_id", workspaceId)
    .single()

  if (agentError || !agent) {
    throw new Error("Agent not found")
  }

  // Create pending run
  const { data: runRow, error: insertError } = await supabase
    .from("agent_runs")
    .insert({
      workspace_id: workspaceId,
      agent_id: agentId,
      input: input.trim(),
      status: "pending",
    })
    .select()
    .single()

  if (insertError || !runRow) {
    throw new Error(insertError?.message ?? "Failed to create run")
  }

  const runId: string = (runRow as AgentRun).id

  // Fetch workspace AI settings
  const { data: settings } = await supabase
    .from("workspace_settings")
    .select("ai_provider, ai_api_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  const provider = settings?.ai_provider ?? null
  const apiKey = settings?.ai_api_key ?? null

  // Attempt to call AI via src/lib/ai complete()
  // complete() handles provider/key resolution internally and never throws —
  // it returns { ok: false, message } when AI is not configured.
  try {
    const { complete } = await import("@/lib/ai")

    await supabase
      .from("agent_runs")
      .update({ status: "running" })
      .eq("id", runId)
      .eq("workspace_id", workspaceId)

    // Pass workspaceOverride so the action doesn't double-query workspace_settings.
    // Only pass when both provider and apiKey are present; otherwise let complete()
    // fall through to its own env/workspace lookup.
    const overrideArg =
      provider && provider !== "none" && apiKey
        ? { provider: provider as import("@/lib/ai").AiProvider, key: apiKey }
        : undefined

    const result = await complete(
      {
        system: agent.system_prompt ?? "You are a helpful assistant.",
        prompt: input.trim(),
        model: agent.model ?? undefined,
      },
      overrideArg
    )

    if (!result.ok) {
      // AI not configured or key missing — store descriptive message, not an error
      await supabase
        .from("agent_runs")
        .update({ status: "error", output: result.message })
        .eq("id", runId)
        .eq("workspace_id", workspaceId)

      revalidatePath("/agents")
      return { runId, error: result.message }
    }

    await supabase
      .from("agent_runs")
      .update({ status: "done", output: result.text })
      .eq("id", runId)
      .eq("workspace_id", workspaceId)

    revalidatePath("/agents")
    return { runId }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"

    await supabase
      .from("agent_runs")
      .update({ status: "error", output: message })
      .eq("id", runId)
      .eq("workspace_id", workspaceId)

    revalidatePath("/agents")
    return { runId, error: message }
  }
}

/**
 * Promote an agent_run's output to a Task.
 */
export async function promoteRunToTask(
  runId: string,
  title: string
): Promise<void> {
  const workspaceId = await requireWorkspace()
  const supabase = await createClient()

  // Fetch the run to get the output
  const { data: run, error: runError } = await supabase
    .from("agent_runs")
    .select("output")
    .eq("id", runId)
    .eq("workspace_id", workspaceId)
    .single()

  if (runError || !run) throw new Error("Run not found")

  const { error } = await supabase.from("tasks").insert({
    workspace_id: workspaceId,
    title: title.trim() || "Task from agent",
    notes: (run as AgentRun).output ?? undefined,
    status: "open",
    priority: 0,
  })

  if (error) throw new Error(error.message)
  revalidatePath("/tasks")
  revalidatePath("/agents")
}

/**
 * Promote an agent_run's output to a Signal.
 */
export async function promoteRunToSignal(
  runId: string,
  title: string
): Promise<void> {
  const workspaceId = await requireWorkspace()
  const supabase = await createClient()

  const { data: run, error: runError } = await supabase
    .from("agent_runs")
    .select("output")
    .eq("id", runId)
    .eq("workspace_id", workspaceId)
    .single()

  if (runError || !run) throw new Error("Run not found")

  const { error } = await supabase.from("signals").insert({
    workspace_id: workspaceId,
    source: "agent",
    title: title.trim() || "Signal from agent",
    body: (run as AgentRun).output ?? undefined,
    status: "new",
  })

  if (error) throw new Error(error.message)
  revalidatePath("/capture")
  revalidatePath("/agents")
}
