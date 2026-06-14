import { PageHeader } from "@/components/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

import { getRecentSignals } from "./actions"
import { CaptureForm } from "./capture-form"
import { SignalItem } from "./signal-item"

export default async function CapturePage() {
  const signals = await getRecentSignals(20)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Capture"
        description="Drop in signals from anywhere — ideas, links, notes. Triage them into tasks when ready."
      />

      {/* Input card */}
      <Card>
        <CardHeader>
          <CardTitle>New capture</CardTitle>
          <CardDescription>
            First line becomes the title. Press <kbd className="rounded border px-1 py-0.5 text-xs font-mono bg-muted">⌘↵</kbd> to save quickly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CaptureForm />
        </CardContent>
      </Card>

      {/* Recent signals */}
      {signals.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-foreground">Recent captures</p>
            <Separator className="flex-1" />
            <p className="text-xs text-muted-foreground">{signals.length} item{signals.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex flex-col gap-2">
            {signals.map((signal) => (
              <SignalItem key={signal.id} signal={signal} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 text-center">
          <p className="text-sm font-medium text-muted-foreground">Nothing captured yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start typing above to save your first signal.
          </p>
        </div>
      )}
    </div>
  )
}
