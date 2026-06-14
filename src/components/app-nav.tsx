"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export type NavItem = {
  href: string
  label: string
}

/**
 * The feature routes of the console, in nav order. Phase 0 ships these as
 * placeholder pages; later agents fill them in. /today is the default page.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today" },
  { href: "/tasks", label: "Tasks" },
  { href: "/obligations", label: "Obligations" },
  { href: "/decisions", label: "Decisions" },
  { href: "/capture", label: "Capture" },
  { href: "/metrics", label: "Metrics" },
  { href: "/briefs", label: "Briefs" },
  { href: "/agents", label: "Agents" },
  { href: "/settings", label: "Settings" },
]

export function AppNav({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
