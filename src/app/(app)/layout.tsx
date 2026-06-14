import Link from "next/link"
import { redirect } from "next/navigation"

import { logout } from "@/app/(auth)/actions"
import { AppNav } from "@/components/app-nav"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Defense in depth: middleware already gates these routes, but a server-side
  // check keeps the layout honest if middleware is ever bypassed.
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-svh flex-col">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b px-4">
        <Link href="/today" className="font-semibold tracking-tight">
          OPC Console
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {user.email}
          </span>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 border-r p-3 md:block">
          <AppNav />
        </aside>

        {/* Mobile nav (horizontal scroll) */}
        <nav className="md:hidden" aria-label="Sections">
          <div className="overflow-x-auto border-b px-3 py-2">
            <AppNav className="flex-row gap-2" />
          </div>
        </nav>

        {/* Main content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
