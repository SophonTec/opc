/**
 * POST /api/ingest/email
 *
 * Receives email forwarding payloads from Cloudflare Email Routing (or any
 * compatible forwarding service) and writes a `signals` row.
 *
 * Expected JSON body:
 * {
 *   from:    string   — sender address
 *   subject: string   — email subject (becomes signal title)
 *   text:    string   — plain-text body (becomes signal body)
 *   ws:      string   — target workspace_id
 *   secret:  string   — must match INGEST_SECRET env var
 * }
 *
 * Security model:
 * - Shared-secret check: the `secret` field in the payload is compared with
 *   the INGEST_SECRET env var using a constant-time comparison to prevent
 *   timing attacks. Requests without a matching secret are rejected with 401.
 * - The Supabase admin client (service-role key) is used so RLS is bypassed;
 *   the `ws` field is validated to be a non-empty UUID-shaped string before
 *   inserting.
 * - All code paths handle missing env gracefully — when INGEST_SECRET or
 *   SUPABASE_SERVICE_ROLE_KEY are absent the handler returns a safe error
 *   instead of crashing.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/types"

// ---------------------------------------------------------------------------
// Constant-time string comparison to prevent timing side-channel attacks.
// Web Crypto is available in all Next.js edge / Node.js Route Handler runtimes.
// ---------------------------------------------------------------------------
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const aBytes = enc.encode(a)
  const bBytes = enc.encode(b)

  // Pad the shorter buffer so both are the same length (prevents early-exit).
  const len = Math.max(aBytes.length, bBytes.length)
  const aPadded = new Uint8Array(len)
  const bPadded = new Uint8Array(len)
  aPadded.set(aBytes)
  bPadded.set(bBytes)

  // Import as HMAC keys and sign an empty message — this forces the runtime to
  // evaluate every byte of both buffers before returning.
  const [keyA, keyB] = await Promise.all([
    crypto.subtle.importKey("raw", aPadded, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    crypto.subtle.importKey("raw", bPadded, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
  ])
  const empty = new Uint8Array(0)
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign("HMAC", keyA, empty),
    crypto.subtle.sign("HMAC", keyB, empty),
  ])

  // Compare the two HMAC outputs byte-by-byte.
  const va = new Uint8Array(sigA)
  const vb = new Uint8Array(sigB)
  let diff = 0
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i]
  return diff === 0
}

// ---------------------------------------------------------------------------
// Lazy admin Supabase client (bypasses RLS, server-only).
// Returns null when env vars are missing so the build never fails.
// ---------------------------------------------------------------------------
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || url === "https://placeholder.supabase.co") return null
  if (!serviceKey || serviceKey === "placeholder") return null

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------------------
// Very lightweight UUID shape check (not a full RFC-4122 validator, but enough
// to reject obviously wrong values and prevent SQL injection).
// ---------------------------------------------------------------------------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse JSON body — return 400 on malformed input.
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 })
  }

  const { from, subject, text, ws, secret } = body as Record<string, unknown>

  // 2. Check required fields exist and are strings.
  if (
    typeof from !== "string" ||
    typeof subject !== "string" ||
    typeof text !== "string" ||
    typeof ws !== "string" ||
    typeof secret !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing or invalid fields: from, subject, text, ws, secret are required strings" },
      { status: 400 },
    )
  }

  // 3. Validate workspace id shape.
  if (!UUID_RE.test(ws)) {
    return NextResponse.json({ error: "ws must be a valid UUID" }, { status: 400 })
  }

  // 4. Validate the ingest secret.
  const envSecret = process.env.INGEST_SECRET ?? ""
  if (!envSecret) {
    // INGEST_SECRET not configured — endpoint is disabled.
    return NextResponse.json({ error: "Ingest endpoint not configured" }, { status: 503 })
  }

  const secretMatches = await timingSafeEqual(secret, envSecret)
  if (!secretMatches) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 5. Get admin client (bypasses RLS so we can write on behalf of the workspace).
  const adminClient = getAdminClient()
  if (!adminClient) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  // 6. Insert signal row.
  const { error: insertError } = await adminClient.from("signals").insert({
    workspace_id: ws,
    source: "email",
    title: subject.slice(0, 500),   // guard against absurdly long subjects
    body: text,
    status: "new",
    external_ref: from.slice(0, 500),
  })

  if (insertError) {
    console.error("[ingest/email] insert error:", insertError.message)
    return NextResponse.json({ error: "Failed to store signal" }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
