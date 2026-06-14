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
import { Textarea } from "@/components/ui/textarea"
import type { Task, TaskStatus } from "@/lib/types"

import { createTask, updateTask } from "./actions"

interface TaskFormProps {
  task?: Task
  onSuccess?: () => void
}

export function TaskForm({ task, onSuccess }: TaskFormProps) {
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<TaskStatus>(task?.status ?? "open")

  const isEdit = Boolean(task)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)

    const formData = new FormData(e.currentTarget)
    // Inject the controlled select value since base-ui select doesn't write to
    // native hidden inputs automatically in all cases.
    formData.set("status", status)

    try {
      if (isEdit && task) {
        await updateTask(task.id, formData)
      } else {
        await createTask(formData)
      }
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setPending(false)
    }
  }

  // Format ISO date string to datetime-local value (YYYY-MM-DDTHH:mm)
  const defaultDueAt = task?.due_at
    ? new Date(task.due_at).toISOString().slice(0, 16)
    : ""

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          name="title"
          placeholder="What needs to be done?"
          defaultValue={task?.title ?? ""}
          required
          autoFocus
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Additional context…"
          defaultValue={task?.notes ?? ""}
          rows={3}
          className="resize-none"
        />
      </div>

      {/* Status + Priority row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="doing">Doing</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="priority">Priority</Label>
          <Input
            id="priority"
            name="priority"
            type="number"
            placeholder="0"
            defaultValue={task?.priority ?? 0}
            min={0}
            max={100}
          />
        </div>
      </div>

      {/* Due date */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="due_at">Due date</Label>
        <Input
          id="due_at"
          name="due_at"
          type="datetime-local"
          defaultValue={defaultDueAt}
        />
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create task"}
        </Button>
      </div>
    </form>
  )
}
