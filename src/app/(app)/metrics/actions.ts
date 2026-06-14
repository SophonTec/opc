'use server'

import { getCurrentWorkspaceId } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SignalSourceStat {
  source: string
  total: number
  this_month: number
}

export interface SignalStatusStat {
  new: number
  triaged: number
  archived: number
  total: number
}

export interface StripeBalance {
  available: { amount: number; currency: string }[]
  pending: { amount: number; currency: string }[]
}

export type StripeBalanceResult =
  | { configured: false }
  | { configured: true; ok: true; balance: StripeBalance }
  | { configured: true; ok: false; error: string }

export interface MetricsData {
  signalStatusStat: SignalStatusStat
  signalSourceStats: SignalSourceStat[]
  stripeBalance: StripeBalanceResult
  monthLabel: string
}

// ---------------------------------------------------------------------------
// Signal aggregations from Supabase
// ---------------------------------------------------------------------------

async function getSignalStats(workspaceId: string): Promise<{
  statusStat: SignalStatusStat
  sourceStats: SignalSourceStat[]
}> {
  const supabase = await createClient()

  // Start of current month in ISO
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: rows } = await supabase
    .from('signals')
    .select('source, status, created_at')
    .eq('workspace_id', workspaceId)

  if (!rows) {
    return {
      statusStat: { new: 0, triaged: 0, archived: 0, total: 0 },
      sourceStats: [],
    }
  }

  // Status counts
  let newCount = 0
  let triagedCount = 0
  let archivedCount = 0
  for (const r of rows) {
    if (r.status === 'new') newCount++
    else if (r.status === 'triaged') triagedCount++
    else if (r.status === 'archived') archivedCount++
  }

  // Per-source stats
  const sourceMap = new Map<string, { total: number; this_month: number }>()
  for (const r of rows) {
    const src = r.source ?? '(unknown)'
    const isThisMonth = r.created_at >= monthStart
    const existing = sourceMap.get(src) ?? { total: 0, this_month: 0 }
    sourceMap.set(src, {
      total: existing.total + 1,
      this_month: existing.this_month + (isThisMonth ? 1 : 0),
    })
  }

  const sourceStats: SignalSourceStat[] = Array.from(sourceMap.entries())
    .map(([source, counts]) => ({ source, ...counts }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  return {
    statusStat: {
      new: newCount,
      triaged: triagedCount,
      archived: archivedCount,
      total: rows.length,
    },
    sourceStats,
  }
}

// ---------------------------------------------------------------------------
// Stripe balance — zero-SDK, plain fetch, graceful degradation
// ---------------------------------------------------------------------------

/**
 * Fetch Stripe account balance using the REST API directly.
 * Uses STRIPE_API_KEY env var. If unset, returns { configured: false }.
 * Never throws — all errors are returned as { configured: true, ok: false }.
 */
async function fetchStripeBalance(): Promise<StripeBalanceResult> {
  const apiKey = process.env.STRIPE_API_KEY
  if (!apiKey) {
    return { configured: false }
  }

  try {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // Opt out of Next.js fetch caching so the balance stays fresh on reload.
      cache: 'no-store',
    })

    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        const body = (await res.json()) as { error?: { message?: string } }
        message = body?.error?.message ?? message
      } catch {
        // ignore JSON parse errors
      }
      return { configured: true, ok: false, error: message }
    }

    const data = (await res.json()) as {
      available: { amount: number; currency: string }[]
      pending: { amount: number; currency: string }[]
    }

    return {
      configured: true,
      ok: true,
      balance: {
        available: data.available,
        pending: data.pending,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { configured: true, ok: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export async function getMetricsData(): Promise<MetricsData> {
  const workspaceId = await getCurrentWorkspaceId()

  const now = new Date()
  const monthLabel = now.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  if (!workspaceId) {
    return {
      signalStatusStat: { new: 0, triaged: 0, archived: 0, total: 0 },
      signalSourceStats: [],
      stripeBalance: { configured: false },
      monthLabel,
    }
  }

  // Run signal aggregation and Stripe fetch in parallel
  const [{ statusStat, sourceStats }, stripeBalance] = await Promise.all([
    getSignalStats(workspaceId),
    fetchStripeBalance(),
  ])

  return {
    signalStatusStat: statusStat,
    signalSourceStats: sourceStats,
    stripeBalance,
    monthLabel,
  }
}
