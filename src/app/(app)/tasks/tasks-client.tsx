"use client"

import * as React from "react"
import { PlusIcon, MoreHorizontalIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Task, TaskStatus } from "@/lib/types"

import { cycleTaskStatus, deleteTask } from "./actions"
import { TaskForm } from "./task-form"

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Open",
  doing: "Doing",
  done: "Done",
}

const STATUS_VARIANT: Record<
  TaskStatus,
  "outline" | "secondary" | "default"
> = {
  open: "outline",
  doing: "secondary",
  done: "default",
}

function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
  )
}

// ---------------------------------------------------------------------------
// Task row actions
// ---------------------------------------------------------------------------

function TaskRowActions({ task }: { task: Task }) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [cyclePending, setCyclePending] = React.useState(false)
  const [deletePending, setDeletePending] = React.useState(false)

  async function handleCycle() {
    setCyclePending(true)
    try {
      await cycleTaskStatus(task.id, task.status)
    } finally {
      setCyclePending(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return
    setDeletePending(true)
    try {
      await deleteTask(task.id)
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <>
      {/* Edit dialog — controlled separately from the dropdown */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          <TaskForm task={task} onSuccess={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Task actions"
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={cyclePending}
            onClick={handleCycle}
          >
            Cycle status
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={deletePending}
            onClick={handleDelete}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface TasksClientProps {
  initialTasks: Task[]
}

export function TasksClient({ initialTasks }: TasksClientProps) {
  const [createOpen, setCreateOpen] = React.useState(false)

  function formatDueAt(due: string | null) {
    if (!due) return <span className="text-muted-foreground">—</span>
    const d = new Date(due)
    const now = new Date()
    const overdue = d < now
    return (
      <span className={overdue ? "text-destructive" : undefined}>
        {d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year:
            d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        })}
      </span>
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {initialTasks.length} task{initialTasks.length !== 1 ? "s" : ""}
        </p>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            <PlusIcon />
            New task
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New task</DialogTitle>
            </DialogHeader>
            <TaskForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      {initialTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm font-medium">No tasks yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first task to get started.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-full">Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="max-w-xs">
                    <p className="truncate font-medium">
                      {task.title ?? "(untitled)"}
                    </p>
                    {task.notes && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {task.notes}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={task.status} />
                  </TableCell>
                  <TableCell>
                    {task.priority > 0 ? (
                      <span className="text-sm font-medium">
                        {task.priority}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDueAt(task.due_at)}
                  </TableCell>
                  <TableCell>
                    <TaskRowActions task={task} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
