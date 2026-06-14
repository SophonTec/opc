/**
 * Unified AI completion entry point.
 *
 * Priority for provider + key resolution:
 *   1. workspace_settings table (BYOK — user-supplied in Settings UI)
 *   2. Environment variables (GEMINI_API_KEY / GROQ_API_KEY + AI_PROVIDER)
 *   3. 'none' — returns NoAiResult with reason='no_provider', never throws
 *
 * Usage (Server Components / Server Actions only — never call from the client):
 *
 *   const result = await complete({ system: "...", prompt: "..." })
 *   if (!result.ok) {
 *     // AI not configured — degrade gracefully
 *     return
 *   }
 *   console.log(result.text)
 */

import { createClient } from "@/lib/supabase/server"
import { getCurrentWorkspaceId } from "@/lib/auth"
import { geminiComplete } from "./providers/gemini"
import { groqComplete } from "./providers/groq"
import type { CompleteOptions, CompleteResult, AiProvider } from "./types"

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read provider + key from workspace_settings for the current user. */
async function getWorkspaceAiConfig(): Promise<{
  provider: AiProvider | null
  key: string | null
}> {
  try {
    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) return { provider: null, key: null }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("workspace_settings")
      .select("ai_provider, ai_api_key")
      .eq("workspace_id", workspaceId)
      .maybeSingle()

    if (error || !data) return { provider: null, key: null }

    const provider = (data.ai_provider as AiProvider | null) ?? null
    const key = data.ai_api_key ?? null
    return { provider, key }
  } catch {
    return { provider: null, key: null }
  }
}

/** Read provider + key from environment variables. */
function getEnvAiConfig(): { provider: AiProvider | null; key: string | null } {
  const envProvider = process.env.AI_PROVIDER as AiProvider | undefined

  if (envProvider === "gemini") {
    const key = process.env.GEMINI_API_KEY ?? null
    return { provider: "gemini", key }
  }
  if (envProvider === "groq") {
    const key = process.env.GROQ_API_KEY ?? null
    return { provider: "groq", key }
  }

  // Auto-detect from present keys
  const geminiKey = process.env.GEMINI_API_KEY ?? null
  if (geminiKey) {
    return { provider: "gemini", key: geminiKey }
  }
  const groqKey = process.env.GROQ_API_KEY ?? null
  if (groqKey) {
    return { provider: "groq", key: groqKey }
  }

  return { provider: null, key: null }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * complete() — call an AI model with a system prompt and user prompt.
 *
 * Always returns a CompleteResult; never throws. Callers MUST check result.ok
 * before using result.text.
 *
 * @param opts - system, prompt, optional model override, optional maxTokens
 * @param workspaceOverride - skip DB lookup and use this config (useful in
 *        Server Actions where you already fetched workspace settings)
 */
export async function complete(
  opts: CompleteOptions,
  workspaceOverride?: { provider: AiProvider; key: string }
): Promise<CompleteResult> {
  // 1. Resolve provider + key (workspace > env > none)
  let provider: AiProvider | null = null
  let key: string | null = null

  if (workspaceOverride) {
    provider = workspaceOverride.provider
    key = workspaceOverride.key
  } else {
    const wsConfig = await getWorkspaceAiConfig()
    if (wsConfig.provider) {
      provider = wsConfig.provider
      key = wsConfig.key
    } else {
      const envConfig = getEnvAiConfig()
      provider = envConfig.provider
      key = envConfig.key
    }
  }

  if (!provider || provider === "none") {
    return {
      ok: false,
      reason: "no_provider",
      message:
        "No AI provider is configured. Visit Settings to add a provider and API key.",
    }
  }

  if (!key) {
    return {
      ok: false,
      reason: "no_key",
      message: `AI provider is set to "${provider}" but no API key was found. Visit Settings to add your key.`,
    }
  }

  // 2. Dispatch to the appropriate provider
  if (provider === "gemini") {
    return geminiComplete(key, opts)
  }
  if (provider === "groq") {
    return groqComplete(key, opts)
  }

  // Unreachable, but satisfies TypeScript exhaustiveness
  return {
    ok: false,
    reason: "no_provider",
    message: `Unknown provider: ${provider}`,
  }
}
