/**
 * POST /api/ingest/:source
 *
 * Generic webhook ingestion endpoint. Accepts any JSON payload, validates the
 * shared INGEST_SECRET, then writes a single `signals` row with status='new'.
 *
 * ## Authentication
 * Pass the secret in **one** of the following ways (checked in order):
 *   1. HTTP header:   `x-ingest-secret: <secret>`
 *   2. Query param:   `?secret=<secret>`
 *
 * ## Required query parameter
 *   - `ws` — the workspace UUID that the signal should belong to.
 *
 * ## Optional query parameter
 *   - `business_id` — UUID of a business to associate the signal with.
 *
 * ## Title / body extraction
 * The handler tries a small set of well-known fields from the JSON body before
 * falling back to generic defaults:
 *
 *   title:  payload.title | payload.subject | payload.summary |
 *           payload.name | payload.event | `:source signal`
 *
 *   body:   payload.body | payload.description | payload.message |
 *           payload.content | payload.text | JSON.stringify(payload)
 *
 * ## external_ref
 * If the payload contains an `id` field its string value is stored in
 * `external_ref` for deduplication / cross-referencing.
 *
 * ## Error responses
 *   401  — missing or invalid INGEST_SECRET
 *   400  — missing `ws` query param, or request body is not valid JSON
 *   503  — server is not configured (missing SUPABASE_SERVICE_ROLE_KEY or URL)
 *   500  — unexpected database write failure
 */

import { NextRequest, NextResponse } from "next/server"
import { getAdminClient } from "../admin"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickTitle(payload: Record<string, unknown>, source: string): string {
  const candidates = ["title", "subject", "summary", "name", "event"] as const
  for (const key of candidates) {
    const val = payload[key]
    if (typeof val === "string" && val.trim()) return val.trim()
  }
  return `${source} signal`
}

function pickBody(payload: Record<string, unknown>): string {
  const candidates = [
    "body",
    "description",
    "message",
    "content",
    "text",
  ] as const
  for (const key of candidates) {
    const val = payload[key]
    if (typeof val === "string" && val.trim()) return val.trim()
  }
  // Fall back to the entire payload so no data is lost.
  return JSON.stringify(payload, null, 2)
}

function pickExternalRef(
  payload: Record<string, unknown>
): string | null {
  const val = payload["id"]
  if (val === undefined || val === null) return null
  return String(val)
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params
  const { searchParams } = new URL(request.url)

  // --- 1. Verify INGEST_SECRET -----------------------------------------------
  const configuredSecret = process.env.INGEST_SECRET

  if (!configuredSecret) {
    // Secret not configured on the server — reject all inbound calls so we
    // don't accidentally accept unauthenticated writes.
    return NextResponse.json(
      { error: "Ingestion endpoint not configured (INGEST_SECRET missing)." },
      { status: 503 }
    )
  }

  const headerSecret = request.headers.get("x-ingest-secret")
  const querySecret = searchParams.get("secret")
  const providedSecret = headerSecret ?? querySecret

  if (!providedSecret || providedSecret !== configuredSecret) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid x-ingest-secret header or ?secret= query param." },
      { status: 401 }
    )
  }

  // --- 2. Validate workspace_id ----------------------------------------------
  const workspaceId = searchParams.get("ws")
  if (!workspaceId) {
    return NextResponse.json(
      { error: "Missing required query parameter: ws (workspace UUID)." },
      { status: 400 }
    )
  }

  const businessId = searchParams.get("business_id") ?? null

  // --- 3. Parse body ---------------------------------------------------------
  let payload: Record<string, unknown>
  try {
    const raw = await request.json()
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 }
      )
    }
    payload = raw as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { error: "Request body is not valid JSON." },
      { status: 400 }
    )
  }

  // --- 4. Get admin client ---------------------------------------------------
  const supabase = getAdminClient()
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Ingestion endpoint not fully configured. " +
          "SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing.",
      },
      { status: 503 }
    )
  }

  // --- 5. Write signal -------------------------------------------------------
  const title = pickTitle(payload, source)
  const body = pickBody(payload)
  const externalRef = pickExternalRef(payload)

  const { data, error } = await supabase
    .from("signals")
    .insert({
      workspace_id: workspaceId,
      business_id: businessId,
      source: source,
      title: title,
      body: body,
      status: "new",
      external_ref: externalRef,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[ingest] DB write failed:", error)
    return NextResponse.json(
      { error: "Failed to persist signal.", detail: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { ok: true, id: data.id, source, workspace_id: workspaceId },
    { status: 201 }
  )
}
