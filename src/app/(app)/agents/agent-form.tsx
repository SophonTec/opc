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
import type { Agent } from "@/lib/types"

import { createAgent, updateAgent } from "./actions"

// ---------------------------------------------------------------------------
// Supported free-tier model presets
// ---------------------------------------------------------------------------

const MODEL_OPTIONS = [
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (free)" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (free)" },
  { value: "llama-3.3-70b-versatile", label: "Groq – Llama 3.3 70B (free)" },
  { value: "llama-3.1-8b-instant", label: "Groq – Llama 3.1 8B (free)" },
  { value: "mixtral-8x7b-32768", label: "Groq – Mixtral 8×7B (free)" },
  { value: "custom", label: "Custom (type below)" },
] as const

interface AgentFormProps {
  agent?: Agent
  onSuccess?: () => void
}

export function AgentForm({ agent, onSuccess }: AgentFormProps) {
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const existingModel = agent?.model ?? ""
  const isPreset = MODEL_OPTIONS.some(
    (o) => o.value !== "custom" && o.value === existingModel
  )

  const [modelSelect, setModelSelect] = React.useState<string>(
    isPreset ? existingModel : existingModel ? "custom" : "gemini-2.0-flash"
  )
  const [customModel, setCustomModel] = React.useState(
    !isPreset ? existingModel : ""
  )

  const isEdit = Boolean(agent)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)

    const formData = new FormData(e.currentTarget)
    // Resolve model value
    const resolvedModel =
      modelSelect === "custom" ? customModel.trim() : modelSelect
    formData.set("model", resolvedModel)

    try {
      if (isEdit && agent) {
        await updateAgent(agent.id, formData)
      } else {
        await createAgent(formData)
      }
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-name">Name *</Label>
        <Input
          id="agent-name"
          name="name"
          placeholder="e.g. Daily Summariser"
          defaultValue={agent?.name ?? ""}
          required
          autoFocus
        />
      </div>

      {/* System prompt */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agent-system-prompt">System prompt</Label>
        <Textarea
          id="agent-system-prompt"
          name="system_prompt"
          placeholder="You are a concise assistant that…"
          defaultValue={agent?.system_prompt ?? ""}
          rows={5}
          className="resize-y font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Instructs the AI how to behave. Leave blank for a generic assistant.
        </p>
      </div>

      {/* Model selector */}
      <div className="flex flex-col gap-1.5">
        <Label>Model</Label>
        <Select value={modelSelect} onValueChange={(v) => setModelSelect(v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pick a model" />
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {modelSelect === "custom" && (
          <Input
            placeholder="e.g. gemini-1.0-pro or llama3-8b-8192"
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            className="mt-1.5 font-mono text-xs"
          />
        )}

        <p className="text-xs text-muted-foreground">
          Gemini Flash and Groq models are free-tier. Requires the matching
          provider + API key in Settings.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create agent"}
        </Button>
      </div>
    </form>
  )
}
