/**
 * Shared Wizard Primitives
 *
 * Reusable building blocks for multi-step widget creation wizards.
 * Used by Distribution and Time Series creation modals.
 */

"use client"

import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

// ─── WizardStepper ───────────────────────────────────────────────────────────

export interface WizardStep {
    label: string
    description?: string
}

interface WizardStepperProps {
    steps: WizardStep[]
    currentStep: number
    onStepClick?: (step: number) => void
}

export function WizardStepper({ steps, currentStep, onStepClick }: WizardStepperProps) {
    return (
        <div className="flex items-center gap-1 w-full px-2">
            {steps.map((step, i) => {
                const isCompleted = i < currentStep
                const isActive = i === currentStep
                const isClickable = onStepClick && i <= currentStep

                return (
                    <div key={i} className="flex items-center flex-1 last:flex-none">
                        {/* Step circle + label */}
                        <button
                            type="button"
                            disabled={!isClickable}
                            onClick={() => isClickable && onStepClick?.(i)}
                            className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200 group",
                                isClickable && "cursor-pointer hover:bg-primary/5",
                                !isClickable && "cursor-default"
                            )}
                        >
                            {/* Circle */}
                            <div
                                className={cn(
                                    "flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold transition-all duration-300 shrink-0",
                                    isCompleted && "bg-primary text-primary-foreground shadow-sm shadow-primary/30",
                                    isActive && "bg-primary/15 text-primary ring-2 ring-primary/40",
                                    !isCompleted && !isActive && "bg-muted/50 text-muted-foreground/50 border border-border/40"
                                )}
                            >
                                {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
                            </div>
                            {/* Label */}
                            <div className="hidden sm:block text-left">
                                <p
                                    className={cn(
                                        "text-xs font-medium leading-tight transition-colors",
                                        isActive && "text-foreground",
                                        isCompleted && "text-foreground/80",
                                        !isActive && !isCompleted && "text-muted-foreground/50"
                                    )}
                                >
                                    {step.label}
                                </p>
                            </div>
                        </button>

                        {/* Connector line */}
                        {i < steps.length - 1 && (
                            <div className="flex-1 mx-1">
                                <div
                                    className={cn(
                                        "h-px w-full transition-all duration-300",
                                        i < currentStep ? "bg-primary/50" : "bg-border/40"
                                    )}
                                />
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

// ─── WizardStepPanel ─────────────────────────────────────────────────────────

interface WizardStepPanelProps {
    title: string
    description?: string
    children: React.ReactNode
    className?: string
}

export function WizardStepPanel({ title, description, children, className }: WizardStepPanelProps) {
    return (
        <div className={cn("space-y-4", className)}>
            <div>
                <h3 className="text-base font-semibold tracking-tight">{title}</h3>
                {description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
                )}
            </div>
            {children}
        </div>
    )
}

// ─── WizardReviewRow ─────────────────────────────────────────────────────────

interface WizardReviewRowProps {
    label: string
    value: React.ReactNode
}

export function WizardReviewRow({ label, value }: WizardReviewRowProps) {
    return (
        <div className="flex items-start justify-between py-2.5 border-b border-border/30 last:border-0">
            <span className="text-sm text-muted-foreground shrink-0">{label}</span>
            <span className="text-sm font-medium text-right ml-4">{value}</span>
        </div>
    )
}

// ─── SelectableChip ──────────────────────────────────────────────────────────

interface SelectableChipProps {
    label: string
    selected: boolean
    onClick: () => void
    accentClass?: string
}

export function SelectableChip({ label, selected, onClick, accentClass }: SelectableChipProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border",
                selected
                    ? `bg-primary/15 border-primary/40 text-primary shadow-sm shadow-primary/10 ${accentClass ?? ""}`
                    : "bg-card/60 border-border/40 text-muted-foreground hover:border-primary/20 hover:bg-card/90"
            )}
        >
            {label}
        </button>
    )
}

// ─── FieldLabel ──────────────────────────────────────────────────────────────

interface FieldLabelProps {
    label: string
    required?: boolean
    hint?: string
}

export function FieldLabel({ label, required, hint }: FieldLabelProps) {
    return (
        <div className="flex items-baseline gap-1.5 mb-1.5">
            <span className="text-sm font-medium">
                {label}
                {required && <span className="text-primary ml-0.5">*</span>}
            </span>
            {hint && <span className="text-[11px] text-muted-foreground/60">{hint}</span>}
        </div>
    )
}
