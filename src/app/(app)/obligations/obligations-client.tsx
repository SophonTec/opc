"use client"

import * as React from "react"
import { PlusIcon, CheckIcon, PencilIcon, TrashIcon, CalendarClockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card"

import type { Obligation } from "@/lib/types"
import type { CreateObligationInput } from "./actions"
import { createObligation, updateObligation, deleteObligation, markObligationDone } from "./actions"
import { ObligationForm } from "./obligation-form"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso))
}

function getDueStatus(ob: Obligation): "overdue" | "upcoming" | "ok" {
  if (!ob.next_due_at) return "ok"
  const now = new Date()
  const due = new Date(ob.next_due_at)
  if (due < now) return "overdue"
  const lead = ob.lead_days ?? 7
  const alertDate = new Date(due)
  alertDate.setDate(alertDate.getDate() - lead)
  if (now >= alertDate) return "upcoming"
  return "ok"
}

function kindLabel(kind: string | null | undefined): string {
  if (!kind) return "Other"
  return kind.charAt(0).toUpperCase() + kind.slice(1)
}

// ---------------------------------------------------------------------------
// Single row card
// ---------------------------------------------------------------------------

function ObligationCard({
  ob,
  onMarkDone,
  onEdit,
  onDelete,
}: {
  ob: Obligation
  onMarkDone: (id: string) => Promise<void>
  onEdit: (ob: Obligation) => void
  onDelete: (id: string) => Promise<void>
}) {
  const [isDoing, setIsDoing] = React.useState(false)
  const status = getDueStatus(ob)

  async function handleMarkDone() {
    setIsDoing(true)
    await onMarkDone(ob.id)
    setIsDoing(false)
  }

  async function handleDelete() {
    if (!confirm(`Delete "${ob.title}"? This cannot be undone.`)) return
    await onDelete(ob.id)
  }

  const statusBadge =
    status === "overdue" ? (
      <Badge variant="destructive">Overdue</Badge>
    ) : status === "upcoming" ? (
      <Badge variant="secondary">Due soon</Badge>
    ) : (
      <Badge variant="outline">On track</Badge>
    )

  return (
    <Card size="sm" className={status === "overdue" ? "border-destructive/30" : undefined}>
      <CardHeader>
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-sm">{ob.title}</CardTitle>
          <CardDescription className="flex items-center gap-1.5 text-xs">
            <span>{kindLabel(ob.kind)}</span>
            {ob.recur_rule && (
              <>
                <span className="text-muted-foreground/50">·</span>
                <span>{ob.recur_rule}</span>
              </>
            )}
          </CardDescription>
        </div>
        <CardAction className="flex items-center gap-1">
          {statusBadge}
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarClockIcon className="size-3.5" />
              Due {formatDate(ob.next_due_at)}
            </span>
            {ob.last_done_at && (
              <span>Last done {formatDate(ob.last_done_at)}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="ghost"
              title="Mark as done"
              onClick={handleMarkDone}
              disabled={isDoing}
            >
              <CheckIcon />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              title="Edit"
              onClick={() => onEdit(ob)}
            >
              <PencilIcon />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              title="Delete"
              onClick={handleDelete}
            >
              <TrashIcon />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface ObligationsClientProps {
  initialObligations: Obligation[]
}

export function ObligationsClient({ initialObligations }: ObligationsClientProps) {
  const [obligations, setObligations] = React.useState<Obligation[]>(initialObligations)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<Obligation | null>(null)

  // Refresh from server via Router after mutations (revalidatePath handles data)
  // We optimistically update client state too for snappiness.

  async function handleCreate(data: CreateObligationInput) {
    const result = await createObligation(data)
    if (result.error) throw new Error(result.error)
    setCreateOpen(false)
    // Next page load (triggered by revalidatePath) will update the list;
    // for now refresh the page to pick up the new row.
    window.location.reload()
  }

  async function handleUpdate(data: CreateObligationInput) {
    if (!editTarget) return
    const result = await updateObligation({ id: editTarget.id, ...data })
    if (result.error) throw new Error(result.error)
    setEditTarget(null)
    window.location.reload()
  }

  async function handleMarkDone(id: string) {
    const result = await markObligationDone(id)
    if (result.error) {
      alert(`Error: ${result.error}`)
      return
    }
    window.location.reload()
  }

  async function handleDelete(id: string) {
    const result = await deleteObligation(id)
    if (result.error) {
      alert(`Error: ${result.error}`)
      return
    }
    setObligations((prev) => prev.filter((o) => o.id !== id))
  }

  // Split into upcoming (overdue + within lead) vs rest
  const upcoming = obligations.filter((o) => getDueStatus(o) !== "ok")
  const later = obligations.filter((o) => getDueStatus(o) === "ok")

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex items-center justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            <PlusIcon />
            New obligation
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New obligation</DialogTitle>
            </DialogHeader>
            <ObligationForm
              onSubmit={handleCreate}
              onCancel={() => setCreateOpen(false)}
              submitLabel="Create"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit obligation</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <ObligationForm
              initialValues={editTarget}
              onSubmit={handleUpdate}
              onCancel={() => setEditTarget(null)}
              submitLabel="Update"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Upcoming / overdue section */}
      {upcoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Needs attention ({upcoming.length})
          </h2>
          <div className="flex flex-col gap-2">
            {upcoming.map((ob) => (
              <ObligationCard
                key={ob.id}
                ob={ob}
                onMarkDone={handleMarkDone}
                onEdit={setEditTarget}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      {/* All other obligations */}
      {later.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Upcoming ({later.length})
          </h2>
          <div className="flex flex-col gap-2">
            {later.map((ob) => (
              <ObligationCard
                key={ob.id}
                ob={ob}
                onMarkDone={handleMarkDone}
                onEdit={setEditTarget}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      {obligations.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <CalendarClockIcon className="size-8 opacity-40" />
          <p className="text-sm">No obligations yet.</p>
          <p className="text-xs">Add taxes, filings, renewals — anything that recurs.</p>
        </div>
      )}
    </div>
  )
}
