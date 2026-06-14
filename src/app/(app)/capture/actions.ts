"use server"

import { revalidatePath } from "next/cache"

import { getCurrentWorkspaceId } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { Signal } from "@/lib/types"

// ---------------------------------------------------------------------------
// createSignal
// ---------------------------------------------------------------------------

export async function createSignal(text: string): Promise<
  { success: true; signal: Signal } | { success: false; error: string }
> {
  if (!text || text.trim().length === 0) {
    return { success: false, error: "Input cannot be empty." }
  }

  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) {
    return { success: false, error: "Not authenticated or no workspace found." }
  }

  const trimmed = text.trim()
  const title = trimmed.split("\n")[0].slice(0, 255)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("signals")
    .insert({
      workspace_id: workspaceId,
      source: "capture",
      title,
      body: trimmed,
      status: "new",
    })
    .select()
    .single()

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? "Failed to create signal.",
    }
  }

  revalidatePath("/capture")
  return { success: true, signal: data as Signal }
}

// ---------------------------------------------------------------------------
// promoteSignalToTask
// ---------------------------------------------------------------------------

export async function promoteSignalToTask(signalId: string): Promise<
  { success: true } | { success: false; error: string }
> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) {
    return { success: false, error: "Not authenticated or no workspace found." }
  }

  const supabase = await createClient()

  // Fetch the signal (RLS ensures it belongs to the current workspace)
  const { data: signal, error: fetchError } = await supabase
    .from("signals")
    .select("*")
    .eq("id", signalId)
    .eq("workspace_id", workspaceId)
    .single()

  if (fetchError || !signal) {
    return { success: false, error: "Signal not found." }
  }

  // Create the task
  const { error: taskError } = await supabase.from("tasks").insert({
    workspace_id: workspaceId,
    title: signal.title ?? signal.body?.slice(0, 255) ?? "Untitled task",
    notes: signal.body,
    status: "open",
    priority: 0,
  })

  if (taskError) {
    return { success: false, error: taskError.message }
  }

  // Mark the signal as triaged
  const { error: updateError } = await supabase
    .from("signals")
    .update({ status: "triaged" })
    .eq("id", signalId)
    .eq("workspace_id", workspaceId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  revalidatePath("/capture")
  return { success: true }
}

// ---------------------------------------------------------------------------
// archiveSignal
// ---------------------------------------------------------------------------

export async function archiveSignal(signalId: string): Promise<
  { success: true } | { success: false; error: string }
> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) {
    return { success: false, error: "Not authenticated or no workspace found." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("signals")
    .update({ status: "archived" })
    .eq("id", signalId)
    .eq("workspace_id", workspaceId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath("/capture")
  return { success: true }
}

// ---------------------------------------------------------------------------
// getRecentSignals
// ---------------------------------------------------------------------------

export async function getRecentSignals(
  limit = 20
): Promise<Signal[]> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .eq("workspace_id", workspaceId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data as Signal[]
}
