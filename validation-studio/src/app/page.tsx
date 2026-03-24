"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { ArrowRight, Settings, Play, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileUpload } from "@/components/validation/file-upload"
import { EventPreview } from "@/components/validation/event-preview"
import { ValidationProgress } from "@/components/validation/validation-progress"
import { HomeIssuesDisplay } from "@/components/validation/home-issues-display"
import { cn } from "@/lib/utils"
import { useValidationRunner } from "@/hooks/useValidationRunner"
import { Configuration } from "@/types/configuration"
import { ConfigCarousel } from "@/components/configuration/config-carousel"
import { SearchEvents } from "@/components/search-events"

export default function Home() {
  const [configs, setConfigs] = useState<Configuration[]>([])
  const [selectedConfig, setSelectedConfig] = useState<Configuration | null>(null)
  const [hasConfigs, setHasConfigs] = useState<boolean | null>(null)
  const [eventData, setEventData] = useState<any | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { isValidationStarted, validationSteps, validationIssues, startValidation, resetValidation } = useValidationRunner()

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const res = await fetch("/api/configurations")
        if (res.ok) {
          const data = await res.json() as Configuration[]
          setConfigs(data)
          const exists = Array.isArray(data) && data.length > 0
          setHasConfigs(exists)
          if (exists) {
            setSelectedConfig(data[0])
          }
        } else {
          setHasConfigs(false)
        }
      } catch (e) {
        console.error("Failed to fetch configs", e)
        setHasConfigs(false)
      }
    }
    fetchConfigs()
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

  const handleStartValidation = () => {
    if (eventData && selectedConfig) {
      startValidation(eventData, selectedConfig)
    }
  }

  if (hasConfigs === null) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <main className="container py-8 max-w-[1600px]">
      <div className="mb-10 space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-6xl mb-2">
          Validation Studio
        </h1>
        <p className="text-xl text-muted-foreground max-w-xl">
          {hasConfigs
            ? "Ready to validate your events with your LLM configurations."
            : "Welcome to Bill Validation Studio. Let's get you set up."}
        </p>
      </div>

      {!hasConfigs ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8 text-center bg-muted/20 rounded-xl border-2 border-dashed p-8 max-w-5xl mx-auto mt-8">
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
        <div className="grid gap-8 lg:grid-cols-2 items-start">
          {/* Left Column: Validation Input */}
          <div className="space-y-6">
            {!eventData ? (
              <Card className="border-2 border-dashed shadow-none hover:bg-muted/5 transition-colors group h-[400px] flex flex-col justify-center">
                <CardHeader className="text-center">
                  <CardTitle className="group-hover:text-primary transition-colors text-2xl">Upload Event</CardTitle>
                  <CardDescription className="text-lg">Upload the JSON file containing the event data you want to validate.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FileUpload onFileUpload={setEventData} />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-left duration-500">
                <EventPreview data={eventData} onRemove={handleReset} />

                <div ref={bottomRef} className="flex justify-end gap-3">
                  <Button variant="outline" onClick={handleReset} disabled={isValidationStarted}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Reset
                  </Button>
                  {(isValidationStarted || validationSteps.length === 0) && (
                    <Button
                      size="lg"
                      className="px-8 shadow-lg shadow-primary/25"
                      onClick={handleStartValidation}
                      disabled={isValidationStarted || !selectedConfig}
                    >
                      {isValidationStarted ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                      Start Validation
                    </Button>
                  )}
                  {!isValidationStarted && validationSteps.length > 0 && (
                    <Button asChild size="lg" className="px-8 bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/25">
                      <Link href="/observability">
                        Go to Observability <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Configuration & Validation Output */}
          <div className="space-y-8">
            {!eventData && (
              <div className="space-y-6">
                <div className="flex justify-end items-end">
                  <SearchEvents onSelect={setEventData} />
                </div>
                <div className="animate-in fade-in slide-in-from-right duration-700">
                  <ConfigCarousel
                    configs={configs}
                    selectedId={selectedConfig?.id || null}
                    onSelect={setSelectedConfig}
                  />
                </div>
              </div>
            )}

            {eventData && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-500">
                <Card className="h-full min-h-[500px] border-primary/20 bg-muted/10 overflow-hidden">
                  <CardHeader className="border-b bg-background/50 backdrop-blur-sm sticky top-0 z-20">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Validation Output</CardTitle>
                        <CardDescription>
                          {isValidationStarted ? "Running analysis with " : "Results for "}
                          <span className="font-semibold text-primary underline decoration-primary/30 underline-offset-4">
                            {selectedConfig?.name}
                          </span>
                        </CardDescription>
                      </div>
                      {isValidationStarted && (
                        <Badge variant="outline" className="animate-pulse bg-primary/10 text-primary border-primary/20 capitalize">
                          {selectedConfig?.builderStrategy.replace('-', ' ')}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className={cn("p-6", (!isValidationStarted && validationSteps.length === 0) && "flex flex-col items-center justify-center text-muted-foreground text-center min-h-[400px]")}>
                    {!isValidationStarted && validationSteps.length === 0 ? (
                      <>
                        <div className="p-6 rounded-full bg-muted mb-4 ring-8 ring-muted/50">
                          <Play className="h-10 w-10 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-xl font-semibold">Ready to Validate</h3>
                        <p className="text-muted-foreground max-w-xs mt-2">
                          Confirm your event data on the left, select a preset above, and click &quot;Start Validation&quot;.
                        </p>
                      </>
                    ) : (
                      <div className="w-full">
                        <ValidationProgress steps={validationSteps} />
                        {!isValidationStarted && validationSteps.length > 0 && (
                          <div className="flex justify-center mt-8 border-t border-dashed pt-8">
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
        </div>
      )}
    </main>
  )
}
