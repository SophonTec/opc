'use server'

import { getCurrentWorkspaceId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { Task, Obligation, Signal } from '@/lib/types'

export interface TodayData {
  tasks: Task[]
  obligations: Obligation[]
  signals: Signal[]
}

/**
 * Fetches all data needed for the Today dashboard.
 *
 * - tasks: open/doing tasks with due_at set, ordered by due_at ascending
 *   (overdue first, then soonest upcoming). Capped at 10 items.
 * - obligations: obligations whose next_due_at falls within the lead_days
 *   window from today. Capped at 10 items.
 * - signals: most recent signals with status = 'new'. Capped at 10 items.
 */
export async function getTodayData(): Promise<TodayData> {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) {
    return { tasks: [], obligations: [], signals: [] }
  }

  const supabase = await createClient()
  const today = new Date()

  // ── Tasks: open or doing, has a due date, ordered earliest first ──────────
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('status', ['open', 'doing'])
    .not('due_at', 'is', null)
    .order('due_at', { ascending: true })
    .limit(10)

  // ── Obligations: next_due_at within lead_days window from now ─────────────
  // We load all non-null next_due_at obligations and filter in JS so we can
  // respect each row's individual lead_days value without a generated column.
  const { data: allObligations } = await supabase
    .from('obligations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .not('next_due_at', 'is', null)
    .order('next_due_at', { ascending: true })
    .limit(50)

  const obligations: Obligation[] = ((allObligations ?? []) as Obligation[]).filter((o) => {
    if (!o.next_due_at) return false
    const nextDue = new Date(o.next_due_at)
    const leadMs = (o.lead_days ?? 7) * 24 * 60 * 60 * 1000
    const windowEnd = new Date(today.getTime() + leadMs)
    // Show if overdue OR within lead_days window
    return nextDue <= windowEnd
  }).slice(0, 10)

  // ── Signals: newest 'new' status signals ──────────────────────────────────
  const { data: signals } = await supabase
    .from('signals')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'new')
    .order('created_at', { ascending: false })
    .limit(10)

  return {
    tasks: tasks ?? [],
    obligations,
    signals: signals ?? [],
  }
}
