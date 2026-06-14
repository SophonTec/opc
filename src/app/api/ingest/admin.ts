/**
 * Minimal Supabase admin client for the ingest API.
 *
 * Uses the service-role key to bypass RLS so that trusted webhook payloads
 * can be written to the `signals` table without an authenticated user session.
 *
 * This module is intentionally isolated to src/app/api/ingest/ and must never
 * be imported by browser-side code.
 *
 * If SUPABASE_SERVICE_ROLE_KEY is absent the factory returns null; callers
 * must handle that case and respond with 503.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/types"

let adminClient: ReturnType<typeof createSupabaseClient<Database>> | null = null

export function getAdminClient(): ReturnType<
  typeof createSupabaseClient<Database>
> | null {
  if (adminClient) return adminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return null
  }

  adminClient = createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      // Disable auto-refresh and session persistence — this is a server-only
      // client used for a single DB write per request.
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return adminClient
}
