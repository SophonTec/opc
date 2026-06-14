import { redirect } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { getCurrentWorkspaceId } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { AiSettingsForm } from "./ai-settings-form"

export const metadata = { title: "Settings — OPC Console" }

export default async function SettingsPage() {
  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) redirect("/login")

  const supabase = await createClient()
  const { data: settings } = await supabase
    .from("workspace_settings")
    .select("ai_provider, ai_api_key")
    .eq("workspace_id", workspaceId)
    .maybeSingle()

  const currentProvider = settings?.ai_provider ?? "none"
  const hasKey = Boolean(settings?.ai_api_key)

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Settings"
        description="Workspace and AI provider configuration."
      />
      <AiSettingsForm currentProvider={currentProvider} hasKey={hasKey} />
    </div>
  )
}
