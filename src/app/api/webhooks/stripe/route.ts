/**
 * POST /api/webhooks/stripe
 *
 * Receives Stripe webhook events and inserts a signal row for payment /
 * charge events. No Stripe SDK — signature verification is hand-rolled with
 * the Web Crypto API so we incur zero additional runtime dependencies.
 *
 * ── Workspace mapping ───────────────────────────────────────────────────────
 * Stripe does not carry an OPC workspace_id natively. The simplest approach
 * for a one-person setup is:
 *
 *   1. Set env var  STRIPE_WS_ID=<your-workspace-uuid>  on the server.
 *      All incoming Stripe events are credited to that workspace.
 *
 *   2. (Advanced) If you run multiple workspaces, add metadata to your Stripe
 *      objects:
 *        - On PaymentIntent creation:  metadata: { opc_workspace_id: "..." }
 *        - On Customer creation:       metadata: { opc_workspace_id: "..." }
 *      The handler reads event.data.object.metadata?.opc_workspace_id and
 *      falls back to STRIPE_WS_ID when absent.
 *
 * ── Configuration steps ─────────────────────────────────────────────────────
 * 1. In the Stripe Dashboard → Developers → Webhooks, create an endpoint
 *    pointing to  https://opc.sophontex.com/api/webhooks/stripe.
 * 2. Select (at minimum) these event types:
 *      payment_intent.succeeded
 *      payment_intent.payment_failed
 *      charge.succeeded
 *      charge.failed
 *      charge.refunded
 * 3. Copy the "Signing secret" (starts with  whsec_) from the webhook detail
 *    page and set it as  STRIPE_WEBHOOK_SECRET  in your environment.
 * 4. Set  STRIPE_WS_ID  to the UUID of your OPC workspace.
 *    (Find it in Supabase → Table Editor → workspaces.)
 * 5. Set  SUPABASE_SERVICE_ROLE_KEY  (server-only) so the route can bypass RLS
 *    when inserting signals — inbound webhooks arrive without a user session.
 *
 * ── Graceful degradation ────────────────────────────────────────────────────
 * - Missing  STRIPE_WEBHOOK_SECRET  → 503 (safe, no secret = no verification)
 * - Missing  STRIPE_WS_ID          → 503 (cannot determine target workspace)
 * - Missing  SUPABASE_SERVICE_ROLE_KEY → 503
 * - Signature mismatch             → 401
 * - Unrecognised event type        → 200 (acknowledged, ignored)
 * - DB insert failure              → 500 with error logged server-side
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/types"

// ---------------------------------------------------------------------------
// Types (minimal — only the fields we actually read)
// ---------------------------------------------------------------------------

interface StripeEventDataObject {
  id?: string
  amount?: number          // charge: cents
  amount_received?: number // payment_intent: cents
  currency?: string
  description?: string | null
  metadata?: Record<string, string>
}

interface StripeEvent {
  id: string
  type: string
  livemode: boolean
  data: {
    object: StripeEventDataObject
  }
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 signature verification (no stripe SDK)
// ---------------------------------------------------------------------------

/**
 * Verify the Stripe-Signature header using the Web Crypto API.
 *
 * Stripe signs each request with:
 *   t=<unix-timestamp>,v1=<hex-hmac-sha256>
 *
 * The signed payload is:  `${timestamp}.${rawBody}`
 * The key is the webhook signing secret (whsec_… → base64 after stripping
 * the prefix — wait, it's NOT base64; the raw bytes are the UTF-8 encoding
 * of the secret string itself).
 *
 * See: https://docs.stripe.com/webhooks#verify-manually
 */
async function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  // Parse t= and v1= from the header
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=")),
  ) as Record<string, string>

  const timestamp = parts["t"]
  const signature = parts["v1"]

  if (!timestamp || !signature) return false

  // Reject replays older than 5 minutes
  const tolerance = 5 * 60 // seconds
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10)
  if (Number.isNaN(age) || age > tolerance || age < -tolerance) return false

  const enc = new TextEncoder()
  const keyData = enc.encode(secret)
  const payload = enc.encode(`${timestamp}.${rawBody}`)

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )

  const mac = await crypto.subtle.sign("HMAC", cryptoKey, payload)
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  // Constant-time comparison to avoid timing attacks
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}

// ---------------------------------------------------------------------------
// Event → signal mapping
// ---------------------------------------------------------------------------

/**
 * Payment / charge event types we care about. Any other type is acknowledged
 * (200) but produces no signal row — avoids cluttering the feed with noise.
 */
const HANDLED_EVENTS = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.succeeded",
  "charge.failed",
  "charge.refunded",
])

/** Format a Stripe amount (cents) as a human-readable currency string. */
function formatAmount(amount: number | undefined, currency: string | undefined): string {
  if (amount == null || !currency) return ""
  const value = (amount / 100).toFixed(2)
  const symbol = currency.toUpperCase() === "USD" ? "$" : currency.toUpperCase() + " "
  return `${symbol}${value}`
}

function buildSignalTitle(event: StripeEvent): string {
  const obj = event.data.object
  const amountField = obj.amount_received ?? obj.amount
  const money = formatAmount(amountField, obj.currency)

  switch (event.type) {
    case "payment_intent.succeeded":
      return money ? `收款 ${money}` : "Payment succeeded"
    case "payment_intent.payment_failed":
      return money ? `付款失败 ${money}` : "Payment failed"
    case "payment_intent.canceled":
      return money ? `付款取消 ${money}` : "Payment canceled"
    case "charge.succeeded":
      return money ? `收款 ${money}` : "Charge succeeded"
    case "charge.failed":
      return money ? `收款失败 ${money}` : "Charge failed"
    case "charge.refunded":
      return money ? `退款 ${money}` : "Charge refunded"
    default:
      return event.type
  }
}

function buildSignalBody(event: StripeEvent): string {
  const obj = event.data.object
  const lines: string[] = [
    `Stripe event: ${event.type}`,
    `Event ID: ${event.id}`,
  ]
  if (obj.id) lines.push(`Object ID: ${obj.id}`)
  if (obj.description) lines.push(`Description: ${obj.description}`)
  if (event.livemode === false) lines.push("(test mode)")
  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const runtime = "nodejs" // crypto.subtle is available in Node runtime

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Env guard ──────────────────────────────────────────────────────────────
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const workspaceId = process.env.STRIPE_WS_ID
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!webhookSecret) {
    console.warn("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured — returning 503")
    return NextResponse.json(
      { error: "Webhook not configured (missing secret)" },
      { status: 503 },
    )
  }

  if (!workspaceId) {
    console.warn("[stripe-webhook] STRIPE_WS_ID not configured — returning 503")
    return NextResponse.json(
      { error: "Webhook not configured (missing workspace mapping)" },
      { status: 503 },
    )
  }

  if (!supabaseUrl || supabaseUrl === "https://placeholder.supabase.co") {
    console.warn("[stripe-webhook] Supabase URL is a placeholder — returning 503")
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    )
  }

  if (!serviceRoleKey) {
    console.warn("[stripe-webhook] SUPABASE_SERVICE_ROLE_KEY not configured — returning 503")
    return NextResponse.json(
      { error: "Database credentials not configured" },
      { status: 503 },
    )
  }

  // ── Read raw body (must be done before .json() consumes the stream) ────────
  const rawBody = await req.text()

  // ── Signature verification ─────────────────────────────────────────────────
  const sigHeader = req.headers.get("stripe-signature") ?? ""
  if (!sigHeader) {
    return NextResponse.json({ error: "Missing Stripe-Signature header" }, { status: 401 })
  }

  const valid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret)
  if (!valid) {
    console.warn("[stripe-webhook] Signature verification failed")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  // ── Parse event ───────────────────────────────────────────────────────────
  let event: StripeEvent
  try {
    event = JSON.parse(rawBody) as StripeEvent
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // ── Acknowledge unhandled event types immediately ─────────────────────────
  if (!HANDLED_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, action: "ignored" })
  }

  // ── Workspace mapping ─────────────────────────────────────────────────────
  // Prefer per-object metadata when present (see module-level docs above).
  const resolvedWorkspaceId =
    event.data.object.metadata?.["opc_workspace_id"] ?? workspaceId

  // ── Insert signal ─────────────────────────────────────────────────────────
  // Use the service-role client so we can write without a user session.
  // RLS is bypassed intentionally for trusted server-to-server ingest.
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { error: dbError } = await supabase.from("signals").insert({
    workspace_id: resolvedWorkspaceId,
    source: "stripe",
    title: buildSignalTitle(event),
    body: buildSignalBody(event),
    status: "new",
    external_ref: event.id,
  })

  if (dbError) {
    console.error("[stripe-webhook] DB insert failed:", dbError)
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }

  return NextResponse.json({ received: true, action: "signal_created" })
}
