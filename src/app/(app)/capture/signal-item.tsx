"use client"

import { useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Signal } from "@/lib/types"

import { archiveSignal, promoteSignalToTask } from "./actions"

interface SignalItemProps {
  signal: Signal
}

const STATUS_VARIANT: Record<
  Signal["status"],
  "default" | "secondary" | "outline"
> = {
  new: "default",
  triaged: "secondary",
  archived: "outline",
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function SignalItem({ signal }: SignalItemProps) {
  const [isPending, startTransition] = useTransition()
  const [promoteError, setPromoteError] = useState<string | null>(null)

  function handlePromote() {
    setPromoteError(null)
    startTransition(async () => {
      const result = await promoteSignalToTask(signal.id)
      if (!result.success) {
        setPromoteError(result.error)
      }
    })
  }

  function handleArchive() {
    startTransition(async () => {
      await archiveSignal(signal.id)
    })
  }

  const preview = signal.body ?? signal.title ?? ""
  const lines = preview.split("\n")
  const firstLine = lines[0]
  const rest = lines.slice(1).join("\n").trim()

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 text-sm ring-1 ring-foreground/5 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="font-medium leading-snug truncate">{firstLine}</p>
          {rest ? (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {rest}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[signal.status]}>{signal.status}</Badge>
        </div>
      </div>

      {promoteError ? (
        <p className="text-xs text-destructive">{promoteError}</p>
      ) : null}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {formatRelative(signal.created_at)}
        </span>
        {signal.status !== "triaged" && signal.status !== "archived" ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={isPending}
              onClick={handlePromote}
            >
              Convert to task
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              disabled={isPending}
              onClick={handleArchive}
            >
              Archive
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
