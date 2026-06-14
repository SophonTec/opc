import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

/**
 * Server-side auth helpers.
 *
 * `getCurrentUser` and `getCurrentWorkspaceId` are wrapped in React's `cache`
 * so they run at most once per request. They never throw on missing env /
 * unauthenticated state — they return `null`, leaving redirect decisions to
 * callers (pages, layouts, actions) and to middleware.
 */

export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

/**
 * Resolve the workspace the current user belongs to.
 *
 * Each user gets exactly one workspace on signup (via the handle_new_user
 * trigger), so we return the first membership. Returns `null` when there is no
 * authenticated user or no membership yet.
 */
export const getCurrentWorkspaceId = cache(async (): Promise<string | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ workspace_id: string }>()

  if (error || !data) return null
  return data.workspace_id
})
