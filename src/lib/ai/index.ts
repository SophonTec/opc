/**
 * Public surface of the AI abstraction layer.
 *
 * Supports two free-tier providers via plain fetch (zero heavy SDK):
 *   - "gemini"  → Google Gemini Flash (GEMINI_API_KEY env or BYOK)
 *   - "groq"    → Groq llama-3.3-70b-versatile (GROQ_API_KEY env or BYOK)
 *   - "none"    → graceful no-op
 *
 * Provider + key resolution priority:
 *   1. workspace_settings table (BYOK — user set in Settings UI)
 *   2. Environment variables (AI_PROVIDER + GEMINI_API_KEY / GROQ_API_KEY)
 *   3. "none" — returns NoAiResult, never throws
 *
 * Usage (Server Components, Server Actions, Route Handlers only):
 *
 *   import { complete } from "@/lib/ai"
 *
 *   const result = await complete({ system: "You are helpful.", prompt: "Hello" })
 *   if (!result.ok) {
 *     // AI not configured — degrade gracefully, never crash
 *     return null
 *   }
 *   return result.text
 */

export { complete } from "./complete"
export type {
  CompleteOptions,
  CompleteResult,
  AiResult,
  NoAiResult,
  AiProvider,
} from "./types"
