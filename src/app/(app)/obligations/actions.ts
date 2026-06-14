"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentWorkspaceId } from "@/lib/auth"
import type { Obligation } from "@/lib/types"
import { computeNextDueAt } from "./recurrence"

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getObligations(): Promise<Obligation[]> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("obligations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("next_due_at", { ascending: true })

  if (error) {
    console.error("getObligations error:", error)
    return []
  }
  return (data ?? []) as Obligation[]
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateObligationInput = {
  title: string
  kind: string
  recur_rule: string
  next_due_at: string // ISO datetime string
  lead_days: number
  business_id?: string | null
}

export async function createObligation(input: CreateObligationInput): Promise<{ error?: string }> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) return { error: "Not authenticated" }

  const supabase = await createClient()
  const { error } = await supabase.from("obligations").insert({
    workspace_id: workspaceId,
    title: input.title,
    kind: input.kind || null,
    recur_rule: input.recur_rule || null,
    next_due_at: input.next_due_at || null,
    lead_days: input.lead_days ?? 7,
    business_id: input.business_id ?? null,
    last_done_at: null,
  })

  if (error) {
    console.error("createObligation error:", error)
    return { error: error.message }
  }

  revalidatePath("/obligations")
  return {}
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export type UpdateObligationInput = Partial<CreateObligationInput> & { id: string }

export async function updateObligation(input: UpdateObligationInput): Promise<{ error?: string }> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) return { error: "Not authenticated" }

  const { id, ...rest } = input
  const supabase = await createClient()
  const { error } = await supabase
    .from("obligations")
    .update({
      ...(rest.title !== undefined && { title: rest.title }),
      ...(rest.kind !== undefined && { kind: rest.kind }),
      ...(rest.recur_rule !== undefined && { recur_rule: rest.recur_rule }),
      ...(rest.next_due_at !== undefined && { next_due_at: rest.next_due_at }),
      ...(rest.lead_days !== undefined && { lead_days: rest.lead_days }),
      ...(rest.business_id !== undefined && { business_id: rest.business_id }),
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId)

  if (error) {
    console.error("updateObligation error:", error)
    return { error: error.message }
  }

  revalidatePath("/obligations")
  return {}
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteObligation(id: string): Promise<{ error?: string }> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) return { error: "Not authenticated" }

  const supabase = await createClient()
  const { error } = await supabase
    .from("obligations")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId)

  if (error) {
    console.error("deleteObligation error:", error)
    return { error: error.message }
  }

  revalidatePath("/obligations")
  return {}
}

// ---------------------------------------------------------------------------
// Mark done — sets last_done_at=now and rolls next_due_at forward
// ---------------------------------------------------------------------------

export async function markObligationDone(id: string): Promise<{ error?: string }> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) return { error: "Not authenticated" }

  const supabase = await createClient()

  // Fetch the current row so we can compute the next due date
  const { data: row, error: fetchError } = await supabase
    .from("obligations")
    .select("recur_rule, next_due_at")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single()

  if (fetchError || !row) {
    return { error: fetchError?.message ?? "Obligation not found" }
  }

  const now = new Date()
  let nextDueAt: string | null = null

  if (row.recur_rule) {
    // Roll from today (or current next_due_at if it's in the future)
    const base = row.next_due_at && new Date(row.next_due_at) > now
      ? new Date(row.next_due_at)
      : now
    nextDueAt = computeNextDueAt(base, row.recur_rule).toISOString()
  }

  const { error } = await supabase
    .from("obligations")
    .update({
      last_done_at: now.toISOString(),
      ...(nextDueAt !== null && { next_due_at: nextDueAt }),
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId)

  if (error) {
    console.error("markObligationDone error:", error)
    return { error: error.message }
  }

  revalidatePath("/obligations")
  return {}
}
