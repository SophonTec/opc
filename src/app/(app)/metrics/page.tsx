import { PageHeader } from '@/components/page-header'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getMetricsData } from './actions'
import type {
  SignalSourceStat,
  SignalStatusStat,
  StripeBalanceResult,
} from './actions'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a Stripe amount (cents integer) as a human-readable currency string.
 * e.g. 12345, 'usd' → '$123.45'
 */
function formatStripeAmount(amount: number, currency: string): string {
  // Stripe amounts are in smallest currency unit (cents for USD).
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount / 100)
  } catch {
    // Fallback for unknown/exotic currencies
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`
  }
}

// ---------------------------------------------------------------------------
// Stat tile — simple number highlight
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-4 ring-1 ring-foreground/10">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-3xl font-semibold tabular-nums leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Signal status section
// ---------------------------------------------------------------------------

function SignalStatusCard({
  stat,
}: {
  stat: SignalStatusStat
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Signal Inbox</CardTitle>
        <CardDescription>
          Lifetime totals across all sources in this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Total" value={stat.total} />
          <StatTile label="New" value={stat.new} sub="awaiting triage" />
          <StatTile label="Triaged" value={stat.triaged} />
          <StatTile label="Archived" value={stat.archived} />
        </div>
        {stat.total === 0 && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No signals yet. Use Capture or set up a webhook to start ingesting.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Signal source breakdown
// ---------------------------------------------------------------------------

function SignalSourceCard({
  sourceStats,
  monthLabel,
}: {
  sourceStats: SignalSourceStat[]
  monthLabel: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Signals by Source</CardTitle>
        <CardDescription>
          Top sources — lifetime count and this month ({monthLabel}).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sourceStats.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No signals recorded yet.
          </p>
        ) : (
          <div className="divide-y">
            {sourceStats.map((s) => (
              <div
                key={s.source}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate text-sm font-medium">{s.source}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {s.this_month} this month
                  </span>
                  <Badge variant="secondary">{s.total} total</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Stripe balance section
// ---------------------------------------------------------------------------

function StripeBalanceCard({ result }: { result: StripeBalanceResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stripe Balance</CardTitle>
        <CardDescription>
          Read-only account balance via Stripe REST API. Set{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
            STRIPE_API_KEY
          </code>{' '}
          (restricted key, read-only) to enable.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!result.configured && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Not configured.</span>
            <Badge variant="outline">Disabled</Badge>
          </div>
        )}

        {result.configured && !result.ok && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-destructive">{result.error}</span>
            <Badge variant="destructive">Error</Badge>
          </div>
        )}

        {result.configured && result.ok && (
          <div className="space-y-4">
            {result.balance.available.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Available
                </p>
                <div className="flex flex-wrap gap-3">
                  {result.balance.available.map((b) => (
                    <span
                      key={b.currency}
                      className="text-2xl font-semibold tabular-nums"
                    >
                      {formatStripeAmount(b.amount, b.currency)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {result.balance.pending.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Pending
                </p>
                <div className="flex flex-wrap gap-3">
                  {result.balance.pending.map((b) => (
                    <span
                      key={b.currency}
                      className="text-lg font-medium tabular-nums text-muted-foreground"
                    >
                      {formatStripeAmount(b.amount, b.currency)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MetricsPage() {
  const { signalStatusStat, signalSourceStats, stripeBalance, monthLabel } =
    await getMetricsData()

  return (
    <div>
      <PageHeader
        title="Metrics"
        description="A quick read on how the business is doing — signals, inbox health, and financials."
      />

      <div className="grid gap-6">
        {/* Signal inbox overview */}
        <SignalStatusCard stat={signalStatusStat} />

        {/* Source breakdown + Stripe side-by-side on wider screens */}
        <div className="grid gap-6 lg:grid-cols-2">
          <SignalSourceCard
            sourceStats={signalSourceStats}
            monthLabel={monthLabel}
          />
          <StripeBalanceCard result={stripeBalance} />
        </div>
      </div>
    </div>
  )
}
