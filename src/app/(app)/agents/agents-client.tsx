"use client"

import * as React from "react"
import { MoreHorizontalIcon, PlusIcon, PlayIcon } from "lucide-react"

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
import type { Agent, AgentRun } from "@/lib/types"

import { deleteAgent, getAgentRuns } from "./actions"
import { AgentForm } from "./agent-form"
import { RunPanel } from "./run-panel"

// ---------------------------------------------------------------------------
// Agent card
// ---------------------------------------------------------------------------

interface AgentCardProps {
  agent: Agent
}

function AgentCard({ agent }: AgentCardProps) {
  const [editOpen, setEditOpen] = React.useState(false)
  const [runOpen, setRunOpen] = React.useState(false)
  const [deletePending, setDeletePending] = React.useState(false)
  const [runs, setRuns] = React.useState<AgentRun[] | null>(null)
  const [loadingRuns, setLoadingRuns] = React.useState(false)

  async function handleOpenRun() {
    setRunOpen(true)
    if (runs === null) {
      setLoadingRuns(true)
      try {
        const data = await getAgentRuns(agent.id)
        setRuns(data)
      } catch {
        setRuns([])
      } finally {
        setLoadingRuns(false)
      }
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete agent "${agent.name}"? All run history will be lost.`)) return
    setDeletePending(true)
    try {
      await deleteAgent(agent.id)
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <>
      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit agent</DialogTitle>
          </DialogHeader>
          <AgentForm agent={agent} onSuccess={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Run dialog */}
      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Run: {agent.name}</DialogTitle>
          </DialogHeader>
          {loadingRuns ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : (
            <RunPanel agent={agent} initialRuns={runs ?? []} />
          )}
        </DialogContent>
      </Dialog>

      {/* Card */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{agent.name ?? "(untitled)"}</p>
            {agent.model && (
              <Badge variant="outline" className="mt-1 text-xs">
                {agent.model}
              </Badge>
            )}
            {agent.system_prompt && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                {agent.system_prompt}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenRun}
            >
              <PlayIcon className="h-3.5 w-3.5" />
              Run
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Agent actions"
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  Edit
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
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface AgentsClientProps {
  initialAgents: Agent[]
  aiConfigured: boolean
}

export function AgentsClient({ initialAgents, aiConfigured }: AgentsClientProps) {
  const [createOpen, setCreateOpen] = React.useState(false)

  return (
    <div>
      {/* AI not configured banner */}
      {!aiConfigured && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <strong>AI not configured.</strong> Agents will record runs but cannot
          call an LLM until you add a provider and API key in{" "}
          <a href="/settings" className="underline underline-offset-2">
            Settings
          </a>
          . Gemini Flash and Groq are free.
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {initialAgents.length} agent{initialAgents.length !== 1 ? "s" : ""}
        </p>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button />}>
            <PlusIcon />
            New agent
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New agent</DialogTitle>
            </DialogHeader>
            <AgentForm onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Agent grid */}
      {initialAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm font-medium">No agents yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first agent to automate recurring AI tasks.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {initialAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  )
}
