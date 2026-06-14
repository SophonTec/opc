/**
 * AI abstraction layer — shared types.
 *
 * Zero heavy SDKs. All provider calls use native fetch.
 * When provider='none' (or no key is configured), complete() returns a
 * well-structured NoAiResult instead of throwing, so every caller can
 * degrade gracefully.
 */

export type AiProvider = "gemini" | "groq" | "none"

export interface CompleteOptions {
  /** System-level instruction for the model. */
  system: string
  /** User prompt / main input. */
  prompt: string
  /**
   * Optional model override. Defaults to the free-tier model for the active
   * provider (gemini-1.5-flash / llama-3.3-70b-versatile).
   */
  model?: string
  /** Max tokens to generate. Provider-specific default applies when omitted. */
  maxTokens?: number
}

/** Returned by complete() when AI is configured and the call succeeds. */
export interface AiResult {
  ok: true
  text: string
  provider: AiProvider
  model: string
}

/** Returned by complete() when provider='none' or no key is available. */
export interface NoAiResult {
  ok: false
  reason: "no_provider" | "no_key" | "error"
  message: string
}

export type CompleteResult = AiResult | NoAiResult
