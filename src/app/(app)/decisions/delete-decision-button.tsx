"use client"

import * as React from "react"
import { Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { deleteDecision } from "./actions"

interface DeleteDecisionButtonProps {
  id: string
  title: string | null
}

export function DeleteDecisionButton({ id, title }: DeleteDecisionButtonProps) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  async function handleDelete() {
    setPending(true)
    setErrorMsg(null)
    const result = await deleteDecision(id)
    setPending(false)
    if (result.error) {
      setErrorMsg(result.error)
      return
    }
    setOpen(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) setErrorMsg(null)
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2Icon />
            <span className="sr-only">Delete decision</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Decision</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{" "}
          <span className="font-medium text-foreground">
            &ldquo;{title ?? "this decision"}&rdquo;
          </span>
          ? This cannot be undone.
        </p>
        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
        <DialogFooter showCloseButton>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
