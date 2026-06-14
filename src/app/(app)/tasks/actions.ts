"use server"

import { revalidatePath } from "next/cache"

import { getCurrentWorkspaceId } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { TaskStatus } from "@/lib/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireWorkspace(): Promise<string> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) throw new Error("Not authenticated")
  return workspaceId
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getTasks() {
  const workspaceId = await requireWorkspace()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createTask(formData: FormData) {
  const workspaceId = await requireWorkspace()
  const supabase = await createClient()

  const title = (formData.get("title") as string | null)?.trim()
  if (!title) throw new Error("Title is required")

  const notes = (formData.get("notes") as string | null)?.trim() || null
  const status = ((formData.get("status") as string | null) ?? "open") as TaskStatus
  const due_at = (formData.get("due_at") as string | null) || null
  const priorityRaw = formData.get("priority") as string | null
  const priority = priorityRaw ? parseInt(priorityRaw, 10) : 0

  const { error } = await supabase.from("tasks").insert({
    workspace_id: workspaceId,
    title,
    notes,
    status,
    due_at: due_at ? new Date(due_at).toISOString() : null,
    priority,
  })

  if (error) throw new Error(error.message)
  revalidatePath("/tasks")
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateTask(id: string, formData: FormData) {
  const workspaceId = await requireWorkspace()
  const supabase = await createClient()

  const title = (formData.get("title") as string | null)?.trim()
  if (!title) throw new Error("Title is required")

  const notes = (formData.get("notes") as string | null)?.trim() || null
  const status = ((formData.get("status") as string | null) ?? "open") as TaskStatus
  const due_at = (formData.get("due_at") as string | null) || null
  const priorityRaw = formData.get("priority") as string | null
  const priority = priorityRaw ? parseInt(priorityRaw, 10) : 0

  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      notes,
      status,
      due_at: due_at ? new Date(due_at).toISOString() : null,
      priority,
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId)

  if (error) throw new Error(error.message)
  revalidatePath("/tasks")
}

// ---------------------------------------------------------------------------
// Status cycle
// ---------------------------------------------------------------------------

export async function cycleTaskStatus(id: string, currentStatus: TaskStatus) {
  const workspaceId = await requireWorkspace()
  const supabase = await createClient()

  const next: Record<TaskStatus, TaskStatus> = {
    open: "doing",
    doing: "done",
    done: "open",
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status: next[currentStatus] })
    .eq("id", id)
    .eq("workspace_id", workspaceId)

  if (error) throw new Error(error.message)
  revalidatePath("/tasks")
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteTask(id: string) {
  const workspaceId = await requireWorkspace()
  const supabase = await createClient()

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId)

  if (error) throw new Error(error.message)
  revalidatePath("/tasks")
}
