"use client"

import { CheckCircle2, Loader2, Circle, AlertTriangle, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

import { ValidationStep as SharedValidationStep, ValidationStatus } from "@/types/validation"

// Extend simple shared step with UI-specific props if needed, or just use it.
// The UI component seems to have 'error', 'details', 'subSteps', 'progress' which are NOT in the shared type.
// We should probably extend the shared type here.

export type { ValidationStatus };

export interface ValidationStep extends SharedValidationStep {
    error?: string
    details?: any
    subSteps?: ValidationStep[]
    progress?: { current: number; total: number }
    globalProgress?: {
        currentPrompt: number;
        totalPrompts: number;
        completedSubPrompts: number;
        totalSubPrompts: number;
        elapsedSeconds: number;
        estimatedSeconds?: number;
    }
    issueCounts?: {
        error: number;
        warning: number;
        info: number;
    }
}

interface ValidationProgressProps {
    steps: ValidationStep[]
    isSubStep?: boolean
}

export function ValidationProgress({ steps, isSubStep }: ValidationProgressProps) {
    return (
        <div className={cn("space-y-6", isSubStep && "space-y-4 mt-2")}>
            {steps.map((step, index) => (
                <div key={step.id} className="flex flex-col relative">
                    {/* Vertical line segment */}
                    {isSubStep && (
                        <div
                            className={cn(
                                "absolute -left-[1.65rem] w-px bg-muted-foreground/30",
                                index === steps.length - 1 ? "top-0 h-3" : "top-0 -bottom-4"
                            )}
                        />
                    )}

                    {/* Branch line for sub-steps */}
                    {isSubStep && (
                        <div className="absolute -left-[1.65rem] top-3 w-[1.7rem] h-px bg-muted-foreground/30" />
                    )}

                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 relative z-10 bg-background/50 backdrop-blur-sm rounded-full">
                            {step.status === "pending" && (
                                <Circle className="h-5 w-5 text-muted-foreground/30" />
                            )}
                            {step.status === "loading" && (
                                <Loader2 className="h-5 w-5 text-primary animate-spin" />
                            )}
                            {step.status === "success" && (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                            )}
                            {step.status === "error" && (
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                            )}
                            {step.status === "warning" && (
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                            )}
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="flex flex-col gap-1 w-full mt-1">
                                <p
                                    className={cn(
                                        "text-sm font-medium leading-none",
                                        step.status === "pending" && "text-muted-foreground",
                                        step.status === "loading" && "text-primary",
                                        (step.status === "success" || step.status === "error" || step.status === "warning") && "text-foreground"
                                    )}
                                >
                                    {step.label}
                                    {step.progress && step.status === "loading" && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                            ({step.progress.current}/{step.progress.total})
                                        </span>
                                    )}
                                </p>

                                {/* Global Progress Display */}
                                {step.globalProgress && step.status === "loading" && (
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-md border border-muted/50 w-fit">
                                        <span className="flex items-center gap-1.5">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                            </span>
                                            {step.globalProgress.elapsedSeconds.toFixed(2)}s elapsed
                                        </span>
                                        <span className="w-px h-3 bg-muted-foreground/30"></span>
                                        <span>
                                            {step.globalProgress.currentPrompt} / {step.globalProgress.totalPrompts} prompts
                                        </span>
                                        {step.globalProgress.estimatedSeconds !== undefined && (
                                            <>
                                                <span className="w-px h-3 bg-muted-foreground/30"></span>
                                                <span className="font-medium">
                                                    ETA: ~{step.globalProgress.estimatedSeconds.toFixed(0)}s
                                                </span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            {step.issueCounts && (
                                <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                                    {step.issueCounts.error > 0 && (
                                        <span className="text-xs font-semibold text-destructive">
                                            {step.issueCounts.error} error{step.issueCounts.error > 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {step.issueCounts.warning > 0 && (
                                        <span className="text-xs font-semibold text-amber-500">
                                            {step.issueCounts.warning} warning{step.issueCounts.warning > 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {step.issueCounts.info > 0 && (
                                        <span className="text-xs font-semibold text-blue-400">
                                            {step.issueCounts.info} info{step.issueCounts.info > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                            )}
                            {step.error && !step.issueCounts && (
                                <p className="text-sm text-destructive mt-1">
                                    {step.error}
                                </p>
                            )}
                        </div>
                        {step.status === "success" && step.details && (
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                                <Eye className="mr-1 h-3 w-3" /> View
                            </Button>
                        )}
                    </div>
                    {step.subSteps && step.subSteps.length > 0 && (
                        <div className="ml-[0.6rem] pl-6 border-l border-muted-foreground/30 my-1">
                            <ValidationProgress steps={step.subSteps} isSubStep />
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}
