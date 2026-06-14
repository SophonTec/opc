import { PageHeader } from "@/components/page-header"
import { getCurrentWorkspaceId } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

import { AgentsClient } from "./agents-client"
import { getAgents } from "./actions"

export default async function AgentsPage() {
  // Fetch agents; render an empty list if auth is missing (middleware handles redirect)
  let agents: Awaited<ReturnType<typeof getAgents>> = []
  let aiConfigured = false

  try {
    agents = await getAgents()

    const workspaceId = await getCurrentWorkspaceId()
    if (workspaceId) {
      const supabase = await createClient()
      const { data } = await supabase
        .from("workspace_settings")
        .select("ai_provider, ai_api_key")
        .eq("workspace_id", workspaceId)
        .maybeSingle()

      const provider = data?.ai_provider ?? null
      const apiKey = data?.ai_api_key ?? null
      aiConfigured = Boolean(provider && provider !== "none" && apiKey)
    }
  } catch {
    // Graceful degradation: unauthenticated or DB unavailable — show empty state
  }

  return (
    <div>
      <PageHeader
        title="Agents"
        description="Define AI helpers with a system prompt and model. Run them on demand and promote outputs to tasks or signals."
      />
      <AgentsClient initialAgents={agents} aiConfigured={aiConfigured} />
    </div>
  )
}
