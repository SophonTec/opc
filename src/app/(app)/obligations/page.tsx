import { PageHeader } from "@/components/page-header"
import { getObligations } from "./actions"
import { ObligationsClient } from "./obligations-client"

export default async function ObligationsPage() {
  const obligations = await getObligations()

  return (
    <div>
      <PageHeader
        title="Obligations"
        description="Recurring commitments — taxes, filings, renewals — before they bite."
      />
      <ObligationsClient initialObligations={obligations} />
    </div>
  )
}
