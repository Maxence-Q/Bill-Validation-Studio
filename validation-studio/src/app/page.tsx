"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { ArrowRight, Settings, Play, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CookieManager } from "@/lib/configuration/cookie-manager"
import { Configuration } from "@/types/configuration"
import { FileUpload } from "@/components/validation/file-upload"
import { EventPreview } from "@/components/validation/event-preview"
import { ValidationProgress } from "@/components/validation/validation-progress"
import { HomeIssuesDisplay } from "@/components/validation/home-issues-display"
import { cn } from "@/lib/utils"
import { useValidationRunner } from "@/hooks/useValidationRunner"

import { SearchEvents } from "@/components/search-events"

export default function Home() {
  const [hasConfigs, setHasConfigs] = useState<boolean | null>(null)
  const [eventData, setEventData] = useState<any | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { isValidationStarted, validationSteps, validationIssues, startValidation, resetValidation } = useValidationRunner()

  useEffect(() => {
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

  useEffect(() => {
    if (eventData && bottomRef.current) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
      }, 100)
    }
  }, [eventData])

  const handleReset = () => {
    setEventData(null)
    resetValidation()
  }

  if (hasConfigs === null) {
    return null
  }

  return (
    <main className="container py-8 max-w-[1600px]">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
          Validation Studio
        </h1>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-xl text-muted-foreground">
            {hasConfigs
              ? "Ready to validate your events with your LLM configurations."
              : "Welcome to Bill Validation Studio. Let's get you set up."}
          </p>
          {hasConfigs && <SearchEvents onSelect={setEventData} />}
        </div>
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
                <EventPreview data={eventData} onRemove={handleReset} />

                <div ref={bottomRef} className="flex justify-end gap-3">
                  <Button variant="outline" onClick={handleReset}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Reset
                  </Button>
                  {(isValidationStarted || validationSteps.length === 0) && (
                    <Button size="lg" className="px-8" onClick={() => startValidation(eventData)} disabled={isValidationStarted}>
                      {isValidationStarted ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                      Start Validation
                    </Button>
                  )}
                  {!isValidationStarted && validationSteps.length > 0 && (
                    <Button asChild size="lg" className="px-8 bg-purple-600 hover:bg-purple-700">
                      <Link href="/observability">
                        Go to Observability <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
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
                <CardContent className={cn("min-h-[300px]", (!isValidationStarted && validationSteps.length === 0) && "flex flex-col items-center justify-center text-muted-foreground text-center")}>
                  {!isValidationStarted && validationSteps.length === 0 ? (
                    <>
                      <div className="p-4 rounded-full bg-muted mb-4">
                        <Play className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <h3 className="text-lg font-medium">Waiting for Validation to Start</h3>
                      <p className="text-sm max-w-xs mt-2">
                        Review your event data on the left, then click &quot;Start Validation&quot; to begin.
                      </p>
                    </>
                  ) : (
                    <div className="w-full">
                      <ValidationProgress steps={validationSteps} />
                      {!isValidationStarted && validationSteps.length > 0 && (
                        <div className="flex justify-center mt-6 border-t pt-4">
                          <HomeIssuesDisplay issues={validationIssues} />
                        </div>
                      )}
                    </div>
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
