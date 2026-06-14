import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"

import { getDecisions } from "./actions"
import { DecisionForm } from "./decision-form"
import { DecisionsList } from "./decisions-list"

export default async function DecisionsPage() {
  const decisions = await getDecisions()

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader
          title="Decisions"
          description="A log of what you decided and why."
        />
        <DecisionForm
          trigger={
            <Button>
              <PlusIcon />
              New Decision
            </Button>
          }
        />
      </div>

      <DecisionsList decisions={decisions} />
    </div>
  )
}
