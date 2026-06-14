"use client"

import * as React from "react"
import { PencilIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Decision } from "@/lib/types"

import { DecisionForm } from "./decision-form"
import { DeleteDecisionButton } from "./delete-decision-button"

interface DecisionsListProps {
  decisions: Decision[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function DecisionsList({ decisions }: DecisionsListProps) {
  if (decisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
        <p className="text-sm">No decisions yet.</p>
        <p className="mt-1 text-xs">
          Start logging decisions to build your decision history.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {decisions.map((decision) => (
        <Card key={decision.id}>
          <CardHeader className="flex-row items-start justify-between gap-4 pb-2">
            <div className="min-w-0">
              <CardTitle className="truncate">{decision.title}</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDate(decision.decided_at)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <DecisionForm
                decision={decision}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                  >
                    <PencilIcon />
                    <span className="sr-only">Edit decision</span>
                  </Button>
                }
              />
              <DeleteDecisionButton id={decision.id} title={decision.title} />
            </div>
          </CardHeader>
          {decision.body ? (
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {decision.body}
              </p>
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  )
}
