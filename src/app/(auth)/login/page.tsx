"use client"

import { Suspense, useActionState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { login, type AuthState } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: AuthState = { error: null }

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") ?? "/today"
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <form action={formAction}>
      <CardContent className="grid gap-4">
        <input type="hidden" name="redirect" value={redirectTo} />
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="mt-2 flex flex-col gap-3">
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/signup" className="font-medium text-foreground underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </form>
  )
}

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in to OPC Console</CardTitle>
        <CardDescription>
          Your operating console for the one-person unicorn.
        </CardDescription>
      </CardHeader>
      <Suspense fallback={<CardContent>Loading…</CardContent>}>
        <LoginForm />
      </Suspense>
    </Card>
  )
}
