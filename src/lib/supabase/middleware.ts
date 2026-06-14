import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

import type { Database } from "@/lib/types"

/**
 * Routes that require an authenticated user. Any path under these prefixes
 * redirects to /login when there is no session.
 */
const PROTECTED_PREFIXES = [
  "/today",
  "/tasks",
  "/obligations",
  "/decisions",
  "/capture",
  "/metrics",
  "/briefs",
  "/agents",
  "/settings",
]

const AUTH_PATHS = ["/login", "/signup"]

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  )
}

/**
 * Refresh the Supabase session cookie and enforce auth on protected routes.
 *
 * Always returns a NextResponse so that refreshed auth cookies are written
 * back. Never throws on missing env (placeholder values are used), so builds
 * and unconfigured local runs don't crash — `getUser()` simply returns null.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder"

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  let userId: string | null = null
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch {
    // Misconfigured / offline Supabase — treat as unauthenticated.
    userId = null
  }

  const { pathname } = request.nextUrl

  // Unauthenticated user hitting a protected route → /login.
  if (!userId && isProtected(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/login"
    redirectUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Authenticated user on an auth page → send to the default app page.
  if (userId && AUTH_PATHS.includes(pathname)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/today"
    redirectUrl.search = ""
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}
