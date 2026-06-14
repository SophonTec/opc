"use client"

import { useState, useTransition } from "react"
import { generateBriefNow } from "./actions"
import type { Brief } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// ---------------------------------------------------------------------------
// Markdown-lite renderer (no external lib)
// ---------------------------------------------------------------------------

/**
 * Very small subset of Markdown → JSX.
 * Handles: ## headings, **bold**, \n paragraph breaks.
 * Good enough for AI-generated briefs.
 */
function renderMarkdown(text: string) {
  const paragraphs = text.split(/\n{2,}/)
  return paragraphs.map((para, pi) => {
    // H2 heading
    if (para.startsWith("## ")) {
      return (
        <h2 key={pi} className="mt-4 mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {para.slice(3).trim()}
        </h2>
      )
    }
    // H3 heading
    if (para.startsWith("### ")) {
      return (
        <h3 key={pi} className="mt-3 mb-1 text-sm font-medium">
          {para.slice(4).trim()}
        </h3>
      )
    }
    // Split on single newlines and render inline bold
    const lines = para.split("\n").map((line, li) => {
      const parts = line.split(/\*\*(.+?)\*\*/g)
      const rendered = parts.map((part, idx) =>
        idx % 2 === 1 ? <strong key={idx}>{part}</strong> : part
      )
      return (
        <span key={li} className="block">
          {rendered}
        </span>
      )
    })
    return (
      <p key={pi} className="text-sm leading-relaxed">
        {lines}
      </p>
    )
  })
}

// ---------------------------------------------------------------------------
// Brief card
// ---------------------------------------------------------------------------

function BriefCard({ brief }: { brief: Brief }) {
  const dateLabel = brief.for_date
    ? new Date(brief.for_date + "T00:00:00").toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown date"

  const todayStr = new Date().toISOString().slice(0, 10)
  const isToday = brief.for_date === todayStr

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-medium">{dateLabel}</CardTitle>
          {isToday && (
            <Badge variant="secondary" className="text-xs">
              Today
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {brief.content ? (
          <div className="prose-sm space-y-1">{renderMarkdown(brief.content)}</div>
        ) : (
          <p className="text-sm text-muted-foreground italic">(no content)</p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface BriefsClientProps {
  initialBriefs: Brief[]
}

export function BriefsClient({ initialBriefs }: BriefsClientProps) {
  const [briefs] = useState<Brief[]>(initialBriefs)
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    setFeedback(null)
    startTransition(async () => {
      const result = await generateBriefNow()
      setFeedback(result)
      if (result.ok) {
        // Optimistically refresh the list — the server action already called
        // revalidatePath, so a full page refresh would work, but we can also
        // trigger a soft fetch by temporarily forcing a re-render. In practice,
        // clicking after the toast the user will navigate or refresh. For now
        // we set a flag so the UI hints to refresh.
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Generate button + feedback */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Daily briefs are auto-generated each morning. You can also generate one on demand.
        </p>
        <Button
          onClick={handleGenerate}
          disabled={isPending}
          size="sm"
          className="shrink-0"
        >
          {isPending ? "Generating…" : "Generate Now"}
        </Button>
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-md border px-4 py-3 text-sm ${
            feedback.ok
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
              : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          {feedback.message}
          {feedback.ok && (
            <span className="ml-1">
              <button
                onClick={() => window.location.reload()}
                className="underline underline-offset-2 hover:no-underline"
              >
                Refresh to see it.
              </button>
            </span>
          )}
        </div>
      )}

      {/* Briefs list */}
      {briefs.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">No briefs yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure AI in Settings, then click &ldquo;Generate Now&rdquo; or wait for the daily cron.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {briefs.map((brief) => (
            <BriefCard key={brief.id} brief={brief} />
          ))}
        </div>
      )}
    </div>
  )
}
