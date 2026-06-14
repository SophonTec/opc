"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Decision } from "@/lib/types"
import { createDecision, updateDecision } from "./actions"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO timestamp as the value for <input type="datetime-local"> */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes())
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DecisionFormProps {
  /** When provided, the form edits an existing decision. */
  decision?: Decision
  /** The element that opens the dialog (rendered via base-ui's render prop). */
  trigger: React.ReactElement
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DecisionForm({ decision, trigger }: DecisionFormProps) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const isEdit = Boolean(decision)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setErrorMsg(null)

    const formData = new FormData(e.currentTarget)

    const result = isEdit
      ? await updateDecision(decision!.id, formData)
      : await createDecision(formData)

    setPending(false)

    if (result.error) {
      setErrorMsg(result.error)
      return
    }

    setOpen(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) setErrorMsg(null)
    setOpen(next)
  }

  const defaultDate = decision?.decided_at
    ? toDatetimeLocal(decision.decided_at)
    : toDatetimeLocal(new Date().toISOString())

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="contents">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Decision" : "New Decision"}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="decision-title">Title</Label>
              <Input
                id="decision-title"
                name="title"
                placeholder="What did you decide?"
                defaultValue={decision?.title ?? ""}
                required
                autoFocus
              />
            </div>

            {/* Decided at */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="decision-date">Decided at</Label>
              <Input
                id="decision-date"
                name="decided_at"
                type="datetime-local"
                defaultValue={defaultDate}
              />
            </div>

            {/* Body / rationale */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="decision-body">Rationale (optional)</Label>
              <Textarea
                id="decision-body"
                name="body"
                placeholder="Why did you make this decision? What context matters?"
                className="min-h-28"
                defaultValue={decision?.body ?? ""}
              />
            </div>

            {errorMsg && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}
          </div>

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
