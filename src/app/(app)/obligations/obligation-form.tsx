"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Obligation } from "@/lib/types"
import type { CreateObligationInput } from "./actions"

// ---------------------------------------------------------------------------
// Preset kind options
// ---------------------------------------------------------------------------
const KIND_OPTIONS = [
  { value: "tax", label: "Tax" },
  { value: "filing", label: "Filing" },
  { value: "renewal", label: "Renewal" },
  { value: "compliance", label: "Compliance" },
  { value: "payment", label: "Payment" },
  { value: "review", label: "Review" },
  { value: "other", label: "Other" },
]

// Preset recur rules for the select
const RECUR_OPTIONS = [
  { value: "every 1 weeks", label: "Every week" },
  { value: "every 2 weeks", label: "Every 2 weeks" },
  { value: "every 1 months", label: "Every month" },
  { value: "every 3 months", label: "Every quarter" },
  { value: "every 6 months", label: "Every 6 months" },
  { value: "every 1 years", label: "Every year" },
  { value: "custom", label: "Custom…" },
]

interface ObligationFormProps {
  initialValues?: Partial<Obligation>
  onSubmit: (data: CreateObligationInput) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

export function ObligationForm({
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = "Save",
}: ObligationFormProps) {
  const [title, setTitle] = React.useState(initialValues?.title ?? "")
  const [kind, setKind] = React.useState(initialValues?.kind ?? "")
  const [recurRule, setRecurRule] = React.useState(initialValues?.recur_rule ?? "")
  const [recurPreset, setRecurPreset] = React.useState<string>(() => {
    if (!initialValues?.recur_rule) return ""
    const preset = RECUR_OPTIONS.find((o) => o.value === initialValues.recur_rule)
    return preset ? preset.value : "custom"
  })
  const [nextDueAt, setNextDueAt] = React.useState<string>(() => {
    if (!initialValues?.next_due_at) return ""
    // Convert ISO to datetime-local format (YYYY-MM-DDTHH:mm)
    return initialValues.next_due_at.slice(0, 16)
  })
  const [leadDays, setLeadDays] = React.useState(initialValues?.lead_days ?? 7)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function handlePresetChange(value: string | null) {
    const next = value ?? ""
    setRecurPreset(next)
    if (next && next !== "custom") {
      setRecurRule(next)
    } else {
      setRecurRule("")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError("Title is required.")
      return
    }
    if (!nextDueAt) {
      setError("Next due date is required.")
      return
    }
    setError(null)
    setIsLoading(true)
    try {
      await onSubmit({
        title: title.trim(),
        kind: kind || "other",
        recur_rule: recurRule.trim(),
        next_due_at: new Date(nextDueAt).toISOString(),
        lead_days: leadDays,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-title">Title</Label>
        <Input
          id="ob-title"
          placeholder="e.g. Annual accounts filing"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      {/* Kind */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-kind">Kind</Label>
        <Select value={kind} onValueChange={(v) => setKind(v ?? "")}>
          <SelectTrigger id="ob-kind" className="w-full">
            <SelectValue placeholder="Select kind…" />
          </SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Recurrence */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-recur">Recurrence</Label>
        <Select value={recurPreset} onValueChange={handlePresetChange}>
          <SelectTrigger id="ob-recur" className="w-full">
            <SelectValue placeholder="Select recurrence…" />
          </SelectTrigger>
          <SelectContent>
            {RECUR_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {recurPreset === "custom" && (
          <Input
            placeholder='e.g. "every 3 months" or "every 14 days"'
            value={recurRule}
            onChange={(e) => setRecurRule(e.target.value)}
            className="mt-1"
          />
        )}
        <p className="text-xs text-muted-foreground">
          Format: <code>every N days|weeks|months|years</code>
        </p>
      </div>

      {/* Next due */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-next-due">Next due</Label>
        <Input
          id="ob-next-due"
          type="datetime-local"
          value={nextDueAt}
          onChange={(e) => setNextDueAt(e.target.value)}
          required
        />
      </div>

      {/* Lead days */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ob-lead-days">Lead days (reminder offset)</Label>
        <Input
          id="ob-lead-days"
          type="number"
          min={0}
          max={365}
          value={leadDays}
          onChange={(e) => setLeadDays(parseInt(e.target.value, 10) || 0)}
        />
        <p className="text-xs text-muted-foreground">
          How many days before the due date to flag this as upcoming.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  )
}
