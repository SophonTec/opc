/**
 * Groq provider — free-tier REST, zero SDK.
 *
 * Default model: llama-3.3-70b-versatile (generous free quota).
 * API reference: https://console.groq.com/docs/openai
 * The Groq API is OpenAI-compatible, so this uses the chat completions endpoint.
 */

import type { CompleteOptions, AiResult, NoAiResult } from "../types"

const DEFAULT_MODEL = "llama-3.3-70b-versatile"
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

export async function groqComplete(
  apiKey: string,
  opts: CompleteOptions
): Promise<AiResult | NoAiResult> {
  const model = opts.model ?? DEFAULT_MODEL

  const body = {
    model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.prompt },
    ],
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
  }

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: `Groq fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)")
    return {
      ok: false,
      reason: "error",
      message: `Groq API error ${res.status}: ${text.slice(0, 300)}`,
    }
  }

  let json: {
    choices?: Array<{ message?: { content?: string } }>
  }
  try {
    json = await res.json()
  } catch {
    return { ok: false, reason: "error", message: "Groq returned invalid JSON." }
  }

  const text = json.choices?.[0]?.message?.content ?? ""
  if (!text) {
    return { ok: false, reason: "error", message: "Groq returned an empty response." }
  }

  return { ok: true, text, provider: "groq", model }
}
