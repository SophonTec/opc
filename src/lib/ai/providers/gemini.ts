/**
 * Google Gemini provider — free-tier REST, zero SDK.
 *
 * Default model: gemini-1.5-flash (free quota, generous RPM).
 * API reference: https://ai.google.dev/api/generate-content
 */

import type { CompleteOptions, AiResult, NoAiResult } from "../types"

const DEFAULT_MODEL = "gemini-1.5-flash"
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

export async function geminiComplete(
  apiKey: string,
  opts: CompleteOptions
): Promise<AiResult | NoAiResult> {
  const model = opts.model ?? DEFAULT_MODEL

  const body = {
    systemInstruction: {
      parts: [{ text: opts.system }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: opts.prompt }],
      },
    ],
    generationConfig: {
      ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
    },
  }

  let res: Response
  try {
    res = await fetch(
      `${BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    )
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: `Gemini fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)")
    return {
      ok: false,
      reason: "error",
      message: `Gemini API error ${res.status}: ${text.slice(0, 300)}`,
    }
  }

  let json: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
    }>
  }
  try {
    json = await res.json()
  } catch {
    return { ok: false, reason: "error", message: "Gemini returned invalid JSON." }
  }

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  if (!text) {
    return { ok: false, reason: "error", message: "Gemini returned an empty response." }
  }

  return { ok: true, text, provider: "gemini", model }
}
