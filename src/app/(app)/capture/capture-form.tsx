"use client"

import { useRef, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

import { createSignal } from "./actions"

interface CaptureFormProps {
  onSuccess?: () => void
}

export function CaptureForm({ onSuccess }: CaptureFormProps) {
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await createSignal(value)
      if (result.success) {
        setValue("")
        textareaRef.current?.focus()
        onSuccess?.()
      } else {
        setError(result.error)
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd+Enter or Ctrl+Enter to submit
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Textarea
        ref={textareaRef}
        placeholder="Anything on your mind — a signal, idea, note, or link. First line becomes the title. Press ⌘↵ to save."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={5}
        disabled={isPending}
        className="resize-none text-sm leading-relaxed"
        autoFocus
      />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {value.length > 0 ? `${value.length} chars` : ""}
        </p>
        <Button
          type="submit"
          disabled={isPending || value.trim().length === 0}
          size="sm"
        >
          {isPending ? "Saving…" : "Capture"}
        </Button>
      </div>
    </form>
  )
}
