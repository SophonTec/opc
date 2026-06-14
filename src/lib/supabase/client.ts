import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/lib/types"

/**
 * Browser-side Supabase client.
 *
 * Created lazily so that importing this module never throws when the
 * environment variables are missing (e.g. during `next build` with placeholder
 * env). The client is only instantiated when `createClient()` is first called.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined

export function createClient() {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder"

  browserClient = createBrowserClient<Database>(url, anonKey)
  return browserClient
}
