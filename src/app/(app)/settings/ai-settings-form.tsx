"use client"

import { useActionState, useTransition, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { saveAiSettings, testAiConnection, type SaveAiSettingsState } from "./actions"

const PROVIDERS = [
  {
    value: "none",
    label: "None (disabled)",
    description: "AI features will show graceful fallbacks. Everything still works.",
    docsUrl: null,
    keyLabel: null,
    defaultModel: null,
  },
  {
    value: "gemini",
    label: "Google Gemini Flash",
    description: "Free tier · gemini-1.5-flash · generous quotas",
    docsUrl: "https://aistudio.google.com/app/apikey",
    keyLabel: "Gemini API Key",
    defaultModel: "gemini-1.5-flash",
  },
  {
    value: "groq",
    label: "Groq",
    description: "Free tier · llama-3.3-70b-versatile · very fast",
    docsUrl: "https://console.groq.com/keys",
    keyLabel: "Groq API Key",
    defaultModel: "llama-3.3-70b-versatile",
  },
] as const

type Provider = (typeof PROVIDERS)[number]["value"]

const initialState: SaveAiSettingsState = { ok: false, message: "" }

export function AiSettingsForm({
  currentProvider,
  hasKey,
}: {
  currentProvider: string
  hasKey: boolean
}) {
  const [selectedProvider, setSelectedProvider] = useState<Provider>(
    (currentProvider as Provider) ?? "none"
  )
  const [state, formAction, pending] = useActionState(saveAiSettings, initialState)

  const [testPending, startTestTransition] = useTransition()
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const chosen = PROVIDERS.find((p) => p.value === selectedProvider) ?? PROVIDERS[0]

  function handleTest() {
    setTestResult(null)
    startTestTransition(async () => {
      const result = await testAiConnection()
      setTestResult(result)
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Provider</CardTitle>
          <CardDescription>
            OPC Console works fully without AI. When configured, AI is used for
            daily briefs, signal triage suggestions, and custom agents.
            Your API key is stored in your workspace — never shared.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-5">
            {/* Provider selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Provider</Label>
              <div className="grid gap-2">
                {PROVIDERS.map((p) => (
                  <label
                    key={p.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                      selectedProvider === p.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="ai_provider"
                      value={p.value}
                      checked={selectedProvider === p.value}
                      onChange={() => setSelectedProvider(p.value)}
                      className="mt-0.5 accent-primary"
                    />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {p.label}
                        {p.value !== "none" && (
                          <Badge variant="secondary" className="text-xs">
                            Free
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* API key input (hidden when provider=none) */}
            {chosen.keyLabel && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ai_api_key" className="text-sm font-medium">
                    {chosen.keyLabel}
                  </Label>
                  {chosen.docsUrl && (
                    <a
                      href={chosen.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline-offset-4 hover:underline"
                    >
                      Get a free key
                    </a>
                  )}
                </div>
                <Input
                  id="ai_api_key"
                  name="ai_api_key"
                  type="password"
                  autoComplete="off"
                  placeholder={hasKey ? "••••••••" : "Paste your API key here"}
                  defaultValue={hasKey ? "••••••••" : ""}
                  className="font-mono text-sm"
                />
                {hasKey && (
                  <p className="text-xs text-muted-foreground">
                    A key is already saved. Leave the field as-is to keep it, or
                    paste a new key to replace it.
                  </p>
                )}
                {chosen.defaultModel && (
                  <p className="text-xs text-muted-foreground">
                    Default model:{" "}
                    <span className="font-mono">{chosen.defaultModel}</span>
                  </p>
                )}
              </div>
            )}

            {/* Status message */}
            {state.message && (
              <p
                className={`text-sm ${
                  state.ok ? "text-green-600" : "text-destructive"
                }`}
              >
                {state.message}
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={pending} size="sm">
                {pending ? "Saving…" : "Save settings"}
              </Button>

              {/* Test connection button — only shown when a provider with a key is selected */}
              {selectedProvider !== "none" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={testPending}
                  onClick={handleTest}
                >
                  {testPending ? "Testing…" : "Test connection"}
                </Button>
              )}
            </div>

            {/* Test result */}
            {testResult && (
              <p
                className={`text-sm ${
                  testResult.ok ? "text-green-600" : "text-destructive"
                }`}
              >
                {testResult.ok ? "Connected: " : "Error: "}
                {testResult.message}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <Separator />

      <Card className="border-dashed bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">No-AI mode</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Selecting <strong>None</strong> (or leaving the key empty) keeps OPC Console
            fully functional — tasks, signals, decisions, obligations, and daily briefs
            all work without any AI. AI is an optional enhancement, never a requirement.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
