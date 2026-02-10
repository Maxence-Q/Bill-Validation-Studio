"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { ArrowRight, Settings, Play, RefreshCw, Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CookieManager } from "@/lib/cookie-manager"
import { Configuration } from "@/types/configuration"
import { FileUpload } from "@/components/validation/file-upload"
import { EventPreview } from "@/components/validation/event-preview"
import { ValidationProgress, ValidationStep } from "@/components/validation/validation-progress"
import { cn } from "@/lib/utils"

export default function Home() {
  const [hasConfigs, setHasConfigs] = useState<boolean | null>(null)
  const [eventData, setEventData] = useState<any | null>(null)
  const [isValidationStarted, setIsValidationStarted] = useState(false)
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const startValidation = async () => {
    setIsValidationStarted(true)
    setValidationSteps([])

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // --- STEP 1: Validate JSON Structure ---
    const step1: ValidationStep = { id: "structure", label: "User's event fulfill expected format", status: "loading" }
    setValidationSteps([step1])

    await delay(1000)

    const requiredKeys = ["Event", "OwnerPOS", "EventDates", "FeeDefinitions", "PriceGroups", "Prices", "RightToSellAndFees"]
    const missingKeys = requiredKeys.filter(key => !eventData[key])
    const hasId = eventData.Event?.Event?.ID !== undefined

    if (missingKeys.length > 0) {
      setValidationSteps(prev => prev.map(s => s.id === "structure" ? { ...s, status: "error", error: `Missing required keys: ${missingKeys.join(", ")}` } : s))
      return
    }

    if (!hasId) {
      setValidationSteps(prev => prev.map(s => s.id === "structure" ? { ...s, status: "error", error: "Missing Event ID at Event.Event.ID" } : s))
      return
    }

    setValidationSteps(prev => prev.map(s => s.id === "structure" ? { ...s, status: "success" } : s))

    // --- STEP 2: Fetch Configs and Tools ---
    const step2: ValidationStep = { id: "configs", label: "Configs and Tools correctly fetched", status: "loading" }
    setValidationSteps(prev => [...prev, step2])

    await delay(1000)

    try {
      const [promptsRes, toolsRes] = await Promise.all([
        fetch("/api/tools/prompts?lang=en"),
        fetch("/api/tools/definitions?lang=en")
      ])

      if (!promptsRes.ok || !toolsRes.ok) throw new Error("Failed to fetch configuration files")

      const promptsData = await promptsRes.json()
      const toolsData = await toolsRes.json()

      // Extract Prompts
      const fullPromptContent = promptsData.content || ""
      const systemMessageMatch = fullPromptContent.split("SYSTEM_MESSAGE =")[1]?.split("USER_PROMPT =")[0]?.trim()
      const userPromptMatch = fullPromptContent.split("USER_PROMPT =")[1]?.trim()

      if (!systemMessageMatch || !userPromptMatch) {
        setValidationSteps(prev => prev.map(s => s.id === "configs" ? { ...s, status: "error", error: "Failed to parse SYSTEM_MESSAGE or USER_PROMPT from prompts_en.md" } : s))
        return
      }

      // Validate Tools structure
      if (!toolsData.content || toolsData.content === "{}" || (typeof toolsData.content === 'string' && toolsData.content.length < 10)) {
        setValidationSteps(prev => prev.map(s => s.id === "configs" ? { ...s, status: "error", error: "tools_en.json appears empty or invalid" } : s))
        return
      }

      setValidationSteps(prev => prev.map(s => s.id === "configs" ? { ...s, status: "success" } : s))

    } catch (error) {
      console.error(error)
      setValidationSteps(prev => prev.map(s => s.id === "configs" ? { ...s, status: "error", error: "Network error fetching configurations" } : s))
      return
    }

    // --- STEP 3: Context Retrieval ---
    const step3: ValidationStep = { id: "context", label: "Retrieving context references...", status: "loading" }
    setValidationSteps(prev => [...prev, step3])

    await delay(1000)

    try {
        const savedConfigs = CookieManager.get("llm_configurations")
        if (!savedConfigs) {
             throw new Error("No configurations found")
        }

        const parsedConfigs = JSON.parse(savedConfigs) as Configuration[]
        if (!parsedConfigs || parsedConfigs.length === 0) {
            throw new Error("Configuration list is empty")
        }

        const activeConfig = parsedConfigs[0] // Assume first config for now
        const refCount = activeConfig.references

        if (typeof refCount !== 'number' || refCount < 1) {
             throw new Error("Invalid reference count in configuration")
        }

        setValidationSteps(prev => prev.map(s => 
            s.id === "context" 
                ? { ...s, status: "success", label: `Found ${refCount} references for the target event` } 
                : s
        ))

    } catch (error) {
        console.error(error)
        setValidationSteps(prev => prev.map(s => 
            s.id === "context" 
                ? { ...s, status: "error", error: error instanceof Error ? error.message : "Failed to retrieve context" } 
                : s
        ))
        return
    }

    // --- STEP 4: LLM (Placeholder) ---
    const step4: ValidationStep = { id: "llm", label: "Sending Prompts to LLM...", status: "pending" }
    setValidationSteps(prev => [...prev, step4])
  }

  useEffect(() => {
    // Check for configurations in cookies
    const savedConfigs = CookieManager.get("llm_configurations")
    if (savedConfigs) {
      try {
        const parsed = JSON.parse(savedConfigs) as Configuration[]
        setHasConfigs(parsed.length > 0)
      } catch (e) {
        setHasConfigs(false)
      }
    } else {
      setHasConfigs(false)
    }
  }, [])

  // Auto-scroll to bottom when eventData is loaded
  useEffect(() => {
    if (eventData && bottomRef.current) {
      // Short timeout to ensure DOM update
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
      }, 100)
    }
  }, [eventData])

  if (hasConfigs === null) {
    return null // Loading state (prevent flicker)
  }

  return (
    <main className="container py-8 max-w-[1600px]">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
          Validation Studio
        </h1>
        <p className="text-xl text-muted-foreground">
          {hasConfigs
            ? "Ready to validate your events with your LLM configurations."
            : "Welcome to Bill LLM Manager. Let's get you set up."}
        </p>
      </div>

      {!hasConfigs ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8 text-center bg-muted/20 rounded-xl border-2 border-dashed p-8 max-w-5xl mx-auto">
          <div className="bg-primary/10 p-6 rounded-full">
            <Settings className="h-16 w-16 text-primary" />
          </div>
          <div className="max-w-md space-y-4">
            <h2 className="text-2xl font-semibold">No Configurations Found</h2>
            <p className="text-muted-foreground">
              To start validating events, you need to define at least one LLM configuration. This includes choosing a model, temperature, and prompt settings.
            </p>
          </div>
          <Button asChild size="lg" className="h-12 px-8 text-lg">
            <Link href="/configuration">
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          {/* Left Column: Validation Input */}
          <div className="space-y-6">
            {!eventData ? (
              <Card className="border-2 border-dashed shadow-none">
                <CardHeader>
                  <CardTitle>Upload Event</CardTitle>
                  <CardDescription>Upload the JSON file containing the event data you want to validate.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FileUpload onFileUpload={setEventData} />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <EventPreview data={eventData} onRemove={() => {
                  setEventData(null)
                  setIsValidationStarted(false)
                  setValidationSteps([])
                }} />

                <div ref={bottomRef} className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => {
                    setEventData(null)
                    setIsValidationStarted(false)
                    setValidationSteps([])
                  }}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Reset
                  </Button>
                  <Button size="lg" className="px-8" onClick={startValidation} disabled={isValidationStarted}>
                    {isValidationStarted ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Start Validation
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Validation Output */}
          {eventData && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="h-full min-h-[500px] border-primary/20 bg-muted/10">
                <CardHeader>
                  <CardTitle>Validation Output</CardTitle>
                  <CardDescription>Results will appear here once validation starts.</CardDescription>
                </CardHeader>
                <CardContent className={cn("h-[300px]", !isValidationStarted && "flex flex-col items-center justify-center text-muted-foreground text-center")}>
                  {!isValidationStarted ? (
                    <>
                      <div className="p-4 rounded-full bg-muted mb-4">
                        <Play className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <h3 className="text-lg font-medium">Waiting for Validation to Start</h3>
                      <p className="text-sm max-w-xs mt-2">
                        Review your event data on the left, then click "Start Validation" to begin.
                      </p>
                    </>
                  ) : (
                    <ValidationProgress steps={validationSteps} />
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
