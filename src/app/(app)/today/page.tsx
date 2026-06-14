import { PageHeader } from '@/components/page-header'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getTodayData } from './actions'
import type { Task, Obligation, Signal } from '@/lib/types'

// ── Date helpers ─────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year:
      d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  })
}

function isOverdue(iso: string): boolean {
  return new Date(iso) < new Date()
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">{message}</p>
  )
}

// ── Tasks section ─────────────────────────────────────────────────────────────

function TaskStatusBadge({ status }: { status: Task['status'] }) {
  if (status === 'doing') {
    return <Badge variant="secondary">In progress</Badge>
  }
  return <Badge variant="outline">Open</Badge>
}

function TaskRow({ task }: { task: Task }) {
  const overdue = task.due_at ? isOverdue(task.due_at) : false
  return (
    <div className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 border-b last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm leading-snug">
          {task.title ?? '(Untitled task)'}
        </p>
        {task.notes && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {task.notes}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {task.due_at && (
          <span
            className={
              overdue
                ? 'text-xs font-medium text-destructive'
                : 'text-xs text-muted-foreground'
            }
          >
            {overdue ? 'Overdue · ' : 'Due '}
            {formatDate(task.due_at)}
          </span>
        )}
        <TaskStatusBadge status={task.status} />
      </div>
    </div>
  )
}

function TasksCard({ tasks }: { tasks: Task[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Due Tasks</CardTitle>
        <CardDescription>
          Open and in-progress tasks with upcoming or overdue due dates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <EmptyState message="No tasks with due dates right now. Add tasks from the Tasks section." />
        ) : (
          <div>
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Obligations section ───────────────────────────────────────────────────────

function ObligationRow({ obligation }: { obligation: Obligation }) {
  const overdue = obligation.next_due_at
    ? isOverdue(obligation.next_due_at)
    : false
  return (
    <div className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 border-b last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm leading-snug">
          {obligation.title ?? '(Untitled obligation)'}
        </p>
        {obligation.kind && (
          <p className="mt-0.5 text-xs text-muted-foreground capitalize">
            {obligation.kind}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {obligation.next_due_at && (
          <span
            className={
              overdue
                ? 'text-xs font-medium text-destructive'
                : 'text-xs text-muted-foreground'
            }
          >
            {overdue ? 'Overdue · ' : 'Due '}
            {formatDate(obligation.next_due_at)}
          </span>
        )}
        <Badge variant="outline">{obligation.lead_days}d window</Badge>
      </div>
    </div>
  )
}

function ObligationsCard({ obligations }: { obligations: Obligation[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Obligations</CardTitle>
        <CardDescription>
          Recurring obligations due within their lead-days window.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {obligations.length === 0 ? (
          <EmptyState message="No obligations need attention right now. Add them from the Obligations section." />
        ) : (
          <div>
            {obligations.map((o) => (
              <ObligationRow key={o.id} obligation={o} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Signals section ───────────────────────────────────────────────────────────

function SignalRow({ signal }: { signal: Signal }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 border-b last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm leading-snug">
          {signal.title ?? '(Untitled signal)'}
        </p>
        {signal.body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {signal.body}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {signal.source && (
          <span className="text-xs text-muted-foreground">{signal.source}</span>
        )}
        <Badge variant="secondary">New</Badge>
      </div>
    </div>
  )
}

function SignalsCard({ signals }: { signals: Signal[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Unread Signals</CardTitle>
        <CardDescription>
          Recent incoming signals that have not yet been triaged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {signals.length === 0 ? (
          <EmptyState message="Inbox zero — no new signals. Use Capture to log incoming information." />
        ) : (
          <div>
            {signals.map((s) => (
              <SignalRow key={s.id} signal={s} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TodayPage() {
  const { tasks, obligations, signals } = await getTodayData()

  const totalItems = tasks.length + obligations.length + signals.length

  return (
    <div>
      <PageHeader
        title="Today"
        description={
          totalItems === 0
            ? "Your daily cockpit — all clear for now."
            : `${totalItems} item${totalItems === 1 ? '' : 's'} needing attention.`
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <TasksCard tasks={tasks} />
        <ObligationsCard obligations={obligations} />
        <SignalsCard signals={signals} />
      </div>
    </div>
  )
}
