"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Bot, Sparkles } from "lucide-react"
import { CompletedModule } from "@/hooks/useValidationRunner"
import { ValidationIssue } from "@/types/validation"

// Sub-components
import { FeedbackAction, FeedbackMap } from "./chat/types"
import { TypingIndicator } from "./chat/typing-indicator"
import { ModuleMessage } from "./chat/module-message"

interface AgentChatProps {
    completedModules: CompletedModule[]
    totalModules: number
    isRunning: boolean
    configName?: string
}

export function AgentChat({ completedModules, totalModules, isRunning, configName }: AgentChatProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const isStillProcessing = isRunning && completedModules.length < totalModules
    const [feedbackMap, setFeedbackMap] = useState<FeedbackMap>({})

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: "smooth"
            })
        }
    }, [completedModules.length, isStillProcessing])

    const handleIssueAction = useCallback(async (issueId: string, action: FeedbackAction) => {
        // Find the issue across all modules to get metadata
        let issueData: ValidationIssue | undefined
        for (const mod of completedModules) {
            issueData = mod.issues.find(i => (i.issueId || `${i.module}-${i.message.slice(0, 30)}`) === issueId)
            if (issueData) break
        }

        // Optimistic update
        setFeedbackMap(prev => ({ ...prev, [issueId]: action }))

        // Persist to backend
        try {
            await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    issueId,
                    module: issueData?.module ?? "",
                    message: issueData?.message ?? "",
                    severity: issueData?.severity ?? "",
                    action,
                }),
            })
        } catch (err) {
            console.error("Failed to persist feedback:", err)
        }
    }, [completedModules])

    return (
        <div className="flex flex-col h-full min-h-[500px]">
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b bg-background/50 backdrop-blur-sm">
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    {isRunning && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-background animate-pulse" />
                    )}
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-foreground">Validation Agent</h3>
                    <p className="text-xs text-muted-foreground">
                        {isRunning ? (
                            <span className="text-emerald-400">Analyzing with {configName}...</span>
                        ) : completedModules.length > 0 ? (
                            `Finished — ${completedModules.length} modules validated`
                        ) : (
                            `Ready to analyze with ${configName}`
                        )}
                    </p>
                </div>
            </div>

            {/* Chat Messages */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-5 space-y-5 scroll-smooth"
            >
                {/* Initial greeting when validation starts */}
                {(isRunning || completedModules.length > 0) && (
                    <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-muted/60 backdrop-blur-sm rounded-2xl rounded-tl-sm p-4 border border-border/50">
                            <p className="text-sm text-muted-foreground">
                                Starting validation with <strong className="text-foreground">{configName}</strong>. I&apos;ll analyze each module and report my findings as they come in.
                            </p>
                        </div>
                    </div>
                )}

                {/* Module messages */}
                {completedModules.map((entry, index) => (
                    <ModuleMessage
                        key={entry.module}
                        entry={entry}
                        index={index}
                        feedbackMap={feedbackMap}
                        onAction={handleIssueAction}
                    />
                ))}

                {/* Typing Indicator */}
                {isStillProcessing && <TypingIndicator />}

                {/* Completion message */}
                {!isRunning && completedModules.length > 0 && (
                    <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div className="bg-muted/60 backdrop-blur-sm rounded-2xl rounded-tl-sm p-4 border border-border/50">
                            <p className="text-sm text-muted-foreground">
                                ✅ All <strong className="text-foreground">{completedModules.length} modules</strong> have been validated. You can review the details above or head to the <strong className="text-foreground">Observability</strong> page for an in-depth analysis.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
