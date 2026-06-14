import { PageHeader } from "@/components/page-header"
import { getBriefs } from "./actions"
import { BriefsClient } from "./briefs-client"

export const metadata = {
  title: "Briefs — OPC Console",
}

export default async function BriefsPage() {
  const briefs = await getBriefs()

  return (
    <div>
      <PageHeader
        title="Daily Briefs"
        description="AI-generated daily operating summaries. Auto-runs each morning; generate on demand any time."
      />
      <BriefsClient initialBriefs={briefs} />
    </div>
  )
}
