"use client"

import { CheckCircle2, Loader2, Circle, AlertTriangle, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type ValidationStatus = "pending" | "loading" | "success" | "error"

export interface ValidationStep {
    id: string
    label: string
    status: ValidationStatus
    error?: string
    details?: any
}

interface ValidationProgressProps {
    steps: ValidationStep[]
}

export function ValidationProgress({ steps }: ValidationProgressProps) {
    return (
        <div className="space-y-6">
            {steps.map((step, index) => (
                <div key={step.id} className="flex items-start gap-3">
                    <div className="mt-0.5">
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
                    </div>
                    <div className="flex-1 space-y-1">
                        <p
                            className={cn(
                                "text-sm font-medium leading-none",
                                step.status === "pending" && "text-muted-foreground",
                                step.status === "loading" && "text-primary",
                                step.status === "success" && "text-foreground",
                                step.status === "error" && "text-destructive"
                            )}
                        >
                            {step.label}
                        </p>
                        {step.error && (
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
            ))}
        </div>
    )
}
