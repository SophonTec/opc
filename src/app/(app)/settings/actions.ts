"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getCurrentWorkspaceId } from "@/lib/auth"
import { complete } from "@/lib/ai"
import type { AiProvider } from "@/lib/ai"

export type SaveAiSettingsState = {
  ok: boolean
  message: string
}

/**
 * Persist AI provider selection and (optional) API key into workspace_settings.
 *
 * - provider can be "gemini", "groq", or "none".
 * - When provider is "none", the key is cleared.
 * - Uses upsert so the row always exists (the new-user trigger creates a row,
 *   but we're defensive here).
 */
export async function saveAiSettings(
  _prev: SaveAiSettingsState,
  formData: FormData
): Promise<SaveAiSettingsState> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) {
    return { ok: false, message: "Not authenticated." }
  }

  const provider = (formData.get("ai_provider") as string | null) ?? "none"
  const rawKey = (formData.get("ai_api_key") as string | null) ?? ""
  // Keep existing key when user submits the masked placeholder
  const keyIsPlaceholder = rawKey === "••••••••"

  const supabase = await createClient()

  // If key is masked placeholder, only update the provider (preserve existing key)
  const updatePayload =
    provider === "none"
      ? { ai_provider: null, ai_api_key: null }
      : keyIsPlaceholder
        ? { ai_provider: provider }
        : { ai_provider: provider, ai_api_key: rawKey.trim() || null }

  const { error } = await supabase
    .from("workspace_settings")
    .upsert(
      { workspace_id: workspaceId, ...updatePayload },
      { onConflict: "workspace_id" }
    )

  if (error) {
    console.error("[settings/saveAiSettings]", error)
    return { ok: false, message: `Failed to save: ${error.message}` }
  }

  revalidatePath("/settings")
  return { ok: true, message: "Settings saved." }
}

/**
 * Send a quick test completion with current workspace settings.
 * Returns the AI response text or an error message.
 */
export async function testAiConnection(): Promise<{
  ok: boolean
  message: string
}> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) return { ok: false, message: "Not authenticated." }

  const supabase = await createClient()
  const { data: settings } = await supabase
    .from("workspace_settings")
    .select("ai_provider, ai_api_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  const provider = settings?.ai_provider ?? null
  const key = settings?.ai_api_key ?? null

  if (!provider || provider === "none") {
    return { ok: false, message: "No AI provider configured." }
  }
  if (!key) {
    return { ok: false, message: "API key is missing." }
  }

  const result = await complete(
    {
      system: "You are a terse assistant.",
      prompt: 'Reply with exactly: "OPC AI connection OK"',
    },
    { provider: provider as AiProvider, key }
  )

  if (!result.ok) {
    return { ok: false, message: result.message }
  }
  return { ok: true, message: result.text }
}
