"use client"

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Agent, AgentRun } from "@/lib/types"

import {
  getAgentRuns,
  promoteRunToSignal,
  promoteRunToTask,
  runAgent,
} from "./actions"

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function RunStatusBadge({ status }: { status: string }) {
  const variant =
    status === "done"
      ? "default"
      : status === "error"
        ? "destructive"
        : status === "running"
          ? "secondary"
          : "outline"

  return <Badge variant={variant as "default" | "destructive" | "secondary" | "outline"}>{status}</Badge>
}

// ---------------------------------------------------------------------------
// Single run card
// ---------------------------------------------------------------------------

function RunCard({ run }: { run: AgentRun }) {
  const [promoteOpen, setPromoteOpen] = React.useState(false)
  const [promoteTitle, setPromoteTitle] = React.useState("")
  const [promoting, setPromoting] = React.useState(false)
  const [promoteError, setPromoteError] = React.useState<string | null>(null)

  async function handlePromote(kind: "task" | "signal") {
    setPromoting(true)
    setPromoteError(null)
    try {
      if (kind === "task") {
        await promoteRunToTask(run.id, promoteTitle)
      } else {
        await promoteRunToSignal(run.id, promoteTitle)
      }
      setPromoteOpen(false)
      setPromoteTitle("")
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : "Failed to promote")
    } finally {
      setPromoting(false)
    }
  }

  const ts = new Date(run.created_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="rounded-lg border bg-card p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{ts}</span>
        <RunStatusBadge status={run.status} />
      </div>

      {/* Input */}
      <div className="mt-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Input
        </p>
        <p className="whitespace-pre-wrap text-sm">{run.input ?? "(empty)"}</p>
      </div>

      {/* Output */}
      {run.output && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Output
          </p>
          <p
            className={`whitespace-pre-wrap text-sm ${
              run.status === "error" ? "text-destructive" : ""
            }`}
          >
            {run.output}
          </p>
        </div>
      )}

      {/* Promote actions — only for successful runs */}
      {run.status === "done" && run.output && (
        <div className="mt-3 border-t pt-3">
          {!promoteOpen ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPromoteOpen(true)}
            >
              Promote to task / signal
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`promote-title-${run.id}`}>Title</Label>
              <input
                id={`promote-title-${run.id}`}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                placeholder="Task or signal title"
                value={promoteTitle}
                onChange={(e) => setPromoteTitle(e.target.value)}
              />
              {promoteError && (
                <p className="text-xs text-destructive">{promoteError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={promoting}
                  onClick={() => handlePromote("task")}
                >
                  Create task
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={promoting}
                  onClick={() => handlePromote("signal")}
                >
                  Create signal
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={promoting}
                  onClick={() => {
                    setPromoteOpen(false)
                    setPromoteError(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Run panel
// ---------------------------------------------------------------------------

interface RunPanelProps {
  agent: Agent
  initialRuns: AgentRun[]
}

export function RunPanel({ agent, initialRuns }: RunPanelProps) {
  const [runs, setRuns] = React.useState<AgentRun[]>(initialRuns)
  const [input, setInput] = React.useState("")
  const [running, setRunning] = React.useState(false)
  const [runError, setRunError] = React.useState<string | null>(null)

  async function handleRun() {
    if (!input.trim()) return
    setRunning(true)
    setRunError(null)

    try {
      const result = await runAgent(agent.id, input)
      // Refresh the runs list from the server to show the new run
      const fresh = await getAgentRuns(agent.id)
      setRuns(fresh)
      if (result.error) {
        setRunError(result.error)
      }
      setInput("")
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to run agent")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Input area */}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`run-input-${agent.id}`}>Prompt</Label>
        <Textarea
          id={`run-input-${agent.id}`}
          placeholder="Type a prompt for this agent…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void handleRun()
            }
          }}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Model: <span className="font-medium">{agent.model ?? "default"}</span>
            {" · "}⌘↵ to run
          </p>
          <Button
            onClick={handleRun}
            disabled={running || !input.trim()}
            size="sm"
          >
            {running ? "Running…" : "Run"}
          </Button>
        </div>
        {runError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {runError}
          </p>
        )}
      </div>

      {/* Run history */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Recent runs ({runs.length})
        </p>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet. Send a prompt above.</p>
        ) : (
          runs.map((run) => <RunCard key={run.id} run={run} />)
        )}
      </div>
    </div>
  )
}
