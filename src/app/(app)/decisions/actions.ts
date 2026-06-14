"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getCurrentWorkspaceId } from "@/lib/auth"
import type { Decision } from "@/lib/types"

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function getDecisions(): Promise<Decision[]> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("decisions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("decided_at", { ascending: false })

  if (error) {
    console.error("getDecisions error:", error.message)
    return []
  }

  return data ?? []
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createDecision(formData: FormData): Promise<{ error?: string }> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) return { error: "Not authenticated" }

  const title = (formData.get("title") as string | null)?.trim()
  const body = (formData.get("body") as string | null)?.trim() ?? null
  const decidedAtRaw = (formData.get("decided_at") as string | null)?.trim()

  if (!title) return { error: "Title is required" }

  const decided_at = decidedAtRaw
    ? new Date(decidedAtRaw).toISOString()
    : new Date().toISOString()

  const supabase = await createClient()
  const { error } = await supabase.from("decisions").insert({
    workspace_id: workspaceId,
    title,
    body: body || null,
    decided_at,
  })

  if (error) return { error: error.message }

  revalidatePath("/decisions")
  return {}
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateDecision(
  id: string,
  formData: FormData
): Promise<{ error?: string }> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) return { error: "Not authenticated" }

  const title = (formData.get("title") as string | null)?.trim()
  const body = (formData.get("body") as string | null)?.trim() ?? null
  const decidedAtRaw = (formData.get("decided_at") as string | null)?.trim()

  if (!title) return { error: "Title is required" }

  const decided_at = decidedAtRaw
    ? new Date(decidedAtRaw).toISOString()
    : undefined

  const supabase = await createClient()
  const { error } = await supabase
    .from("decisions")
    .update({
      title,
      body: body || null,
      ...(decided_at ? { decided_at } : {}),
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId)

  if (error) return { error: error.message }

  revalidatePath("/decisions")
  return {}
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteDecision(id: string): Promise<{ error?: string }> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) return { error: "Not authenticated" }

  const supabase = await createClient()
  const { error } = await supabase
    .from("decisions")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId)

  if (error) return { error: error.message }

  revalidatePath("/decisions")
  return {}
}
