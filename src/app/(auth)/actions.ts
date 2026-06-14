"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export type AuthState = { error: string | null }

/**
 * Email + password sign-in. On success, redirects to the post-login target.
 * On failure, returns an error string for the form to display.
 */
export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const redirectTo = String(formData.get("redirect") ?? "") || "/today"

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  redirect(redirectTo)
}

/**
 * Email + password sign-up. The handle_new_user trigger provisions a
 * workspace, an owner membership, and a settings row automatically.
 *
 * If the project requires email confirmation, there is no session yet, so we
 * surface a "check your inbox" message instead of redirecting.
 */
export async function signup(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { error: "Email and password are required." }
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return { error: error.message }
  }

  // No session means email confirmation is on.
  if (!data.session) {
    return { error: "Check your inbox to confirm your email, then sign in." }
  }

  redirect("/today")
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
