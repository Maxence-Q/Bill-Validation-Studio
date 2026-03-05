/**
 * CreateTimeSeriesWidgetModal
 *
 * 5-step wizard for creating a Time Series widget.
 * Steps: Basic Info → Metric Selection → Grouping & Scope → Default Filters → Review & Create
 */

"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LineChart, ArrowRight, Sparkles } from "lucide-react"
import {
    WizardStepper,
    WizardStepPanel,
    WizardReviewRow,
    SelectableChip,
    FieldLabel,
    WizardStep,
} from "@/components/dashboard/widgets/shared/wizard-primitives"
import {
    MODULES,
    PERTURBATION_TYPES,
    METRIC_OPTIONS,
    GROUP_BY_OPTIONS,
    AGGREGATION_OPTIONS,
    RUN_SELECTION_PRESETS,
    metricLabel,
    groupByLabel,
    aggregationLabel,
    runSelectionLabel,
} from "@/components/dashboard/widgets/shared/widget-helpers"
import { WidgetDefinition, RunSelection, GroupBy, Aggregation } from "@/types/widget"

// ─── Steps ───────────────────────────────────────────────────────────────────

const STEPS: WizardStep[] = [
    { label: "Basic Info" },
    { label: "Metrics" },
    { label: "Grouping" },
    { label: "Filters" },
    { label: "Review" },
]

// ─── Component ───────────────────────────────────────────────────────────────

interface CreateTimeSeriesWidgetModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreate: (data: { name: string; description: string; definition: WidgetDefinition }) => void
}

export function CreateTimeSeriesWidgetModal({
    open,
    onOpenChange,
    onCreate,
}: CreateTimeSeriesWidgetModalProps) {
    const [step, setStep] = useState(0)

    // Step 1: Basic Info
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")

    // Step 2: Metrics
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["precision", "recall"])

    // Step 3: Grouping & Scope
    const [groupBy, setGroupBy] = useState<GroupBy>(null)
    const [scopeModules, setScopeModules] = useState<string[]>([])
    const [scopePertTypes, setScopePertTypes] = useState<string[]>([])
    const [targetThreshold, setTargetThreshold] = useState("")

    // Step 4: Filters
    const [runPreset, setRunPreset] = useState("all")
    const [aggregation, setAggregation] = useState<Aggregation>(null)

    const resetForm = () => {
        setStep(0)
        setTitle("")
        setDescription("")
        setSelectedMetrics(["precision", "recall"])
        setGroupBy(null)
        setScopeModules([])
        setScopePertTypes([])
        setTargetThreshold("")
        setRunPreset("all")
        setAggregation(null)
    }

    const handleOpenChange = (v: boolean) => {
        if (!v) resetForm()
        onOpenChange(v)
    }

    const canProceed = (s: number): boolean => {
        if (s === 0) return title.trim().length > 0
        if (s === 1) return selectedMetrics.length > 0
        return true
    }

    const handleNext = () => {
        if (step < STEPS.length - 1) setStep(step + 1)
    }

    const handleBack = () => {
        if (step > 0) setStep(step - 1)
    }

    const toggleMetric = (metric: string) => {
        setSelectedMetrics((prev) =>
            prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]
        )
    }

    const toggleModule = (mod: string) => {
        setScopeModules((prev) =>
            prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
        )
    }

    const togglePertType = (pt: string) => {
        setScopePertTypes((prev) =>
            prev.includes(pt) ? prev.filter((p) => p !== pt) : [...prev, pt]
        )
    }

    const getRunSelection = (): RunSelection => {
        const preset = RUN_SELECTION_PRESETS.find((p) => p.value === runPreset)
        return preset?.selection ?? { type: "latest", count: 0 }
    }

    const handleCreate = () => {
        const threshold = parseFloat(targetThreshold)
        const definition: WidgetDefinition = {
            query: {
                runSelection: getRunSelection(),
                scope: {
                    modules: scopeModules,
                    perturbationTypes: scopePertTypes,
                },
                metrics: selectedMetrics,
                groupBy,
                aggregation,
            },
            ...(isFinite(threshold) && threshold > 0 ? { targetThreshold: threshold } : {}),
        }
        onCreate({ name: title.trim(), description: description.trim(), definition })
        resetForm()
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-3xl sm:max-w-3xl p-0 flex flex-col overflow-hidden border border-border/60 bg-card/95 backdrop-blur-xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-transparent px-6 pt-6 pb-4 border-b border-border/40">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                            <LineChart className="h-5 w-5 text-violet-400" />
                            Create Time Series Widget
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground mt-1 text-left">
                            Track the evolution of metrics over time or across iterations.
                        </p>
                    </DialogHeader>
                </div>

                {/* Stepper */}
                <div className="px-6 pt-4 pb-2">
                    <WizardStepper steps={STEPS} currentStep={step} onStepClick={(s) => s <= step && setStep(s)} />
                </div>

                {/* Step content */}
                <div className="px-6 py-4 min-h-[280px]">
                    {/* Step 1: Basic Info */}
                    {step === 0 && (
                        <WizardStepPanel title="Basic Information" description="Give your widget a name and optional description.">
                            <div className="space-y-4">
                                <div>
                                    <FieldLabel label="Widget Title" required />
                                    <Input
                                        id="ts-title"
                                        placeholder="e.g. EventDates_Progress"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="bg-background/60 border-border/50"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <FieldLabel label="Description" hint="optional" />
                                    <Input
                                        id="ts-desc"
                                        placeholder="What does this widget track?"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="bg-background/60 border-border/50"
                                    />
                                </div>
                            </div>
                        </WizardStepPanel>
                    )}

                    {/* Step 2: Metric Selection */}
                    {step === 1 && (
                        <WizardStepPanel title="Metric Selection" description="Choose which metrics to plot on the line chart.">
                            <div>
                                <FieldLabel label="Metrics" required hint="Select one or more" />
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {METRIC_OPTIONS.map((m) => (
                                        <SelectableChip
                                            key={m.value}
                                            label={m.label}
                                            selected={selectedMetrics.includes(m.value)}
                                            onClick={() => toggleMetric(m.value)}
                                        />
                                    ))}
                                </div>
                                {selectedMetrics.length === 0 && (
                                    <p className="text-xs text-destructive mt-2">Select at least one metric.</p>
                                )}
                            </div>
                        </WizardStepPanel>
                    )}

                    {/* Step 3: Grouping & Scope */}
                    {step === 2 && (
                        <WizardStepPanel title="Grouping & Scope" description="Configure how data is grouped and which modules to include.">
                            <div className="space-y-5">
                                {/* Group By */}
                                <div>
                                    <FieldLabel label="Group By" hint="Leave as Global for overall metrics" />
                                    <Select value={groupBy ?? "none"} onValueChange={(v) => setGroupBy(v === "none" ? null : v as GroupBy)}>
                                        <SelectTrigger className="bg-background/60 border-border/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Global (no grouping)</SelectItem>
                                            {GROUP_BY_OPTIONS.map((o) => (
                                                <SelectItem key={o.value ?? "null"} value={o.value ?? ""}>{o.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Scope: Modules */}
                                <div>
                                    <FieldLabel label="Scope — Modules" hint="empty = all modules" />
                                    <div className="flex flex-wrap gap-1.5">
                                        {MODULES.map((mod) => (
                                            <SelectableChip
                                                key={mod}
                                                label={mod}
                                                selected={scopeModules.includes(mod)}
                                                onClick={() => toggleModule(mod)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Scope: Perturbation Types */}
                                {groupBy === "perturbation_type" && (
                                    <div>
                                        <FieldLabel label="Scope — Perturbation Types" hint="empty = all" />
                                        <div className="flex flex-wrap gap-1.5">
                                            {PERTURBATION_TYPES.map((pt) => (
                                                <SelectableChip
                                                    key={pt}
                                                    label={pt}
                                                    selected={scopePertTypes.includes(pt)}
                                                    onClick={() => togglePertType(pt)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Target threshold */}
                                <div>
                                    <FieldLabel label="Target Threshold" hint="optional — goal line on chart (e.g. 0.95)" />
                                    <Input
                                        id="ts-threshold"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="1"
                                        placeholder="e.g. 0.95"
                                        value={targetThreshold}
                                        onChange={(e) => setTargetThreshold(e.target.value)}
                                        className="bg-background/60 border-border/50 w-32"
                                    />
                                </div>
                            </div>
                        </WizardStepPanel>
                    )}

                    {/* Step 4: Default Filters */}
                    {step === 3 && (
                        <WizardStepPanel title="Default Filters" description="Configure which runs to include by default.">
                            <div className="space-y-5">
                                <div>
                                    <FieldLabel label="Run Selection" />
                                    <Select value={runPreset} onValueChange={setRunPreset}>
                                        <SelectTrigger className="bg-background/60 border-border/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {RUN_SELECTION_PRESETS.map((p) => (
                                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <FieldLabel label="Aggregation" hint="How to combine multi-run data" />
                                    <Select value={aggregation ?? "none"} onValueChange={(v) => setAggregation(v === "none" ? null : v as Aggregation)}>
                                        <SelectTrigger className="bg-background/60 border-border/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {AGGREGATION_OPTIONS.filter(o => o.value !== null).map((o) => (
                                                <SelectItem key={o.value!} value={o.value!}>{o.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </WizardStepPanel>
                    )}

                    {/* Step 5: Review */}
                    {step === 4 && (
                        <WizardStepPanel title="Review & Create" description="Confirm your widget configuration.">
                            <div className="rounded-xl border border-border/40 bg-background/40 p-4">
                                <WizardReviewRow label="Title" value={title} />
                                <WizardReviewRow label="Description" value={description || "—"} />
                                <WizardReviewRow
                                    label="Metrics"
                                    value={selectedMetrics.map(metricLabel).join(", ")}
                                />
                                <WizardReviewRow label="Group By" value={groupByLabel(groupBy)} />
                                <WizardReviewRow
                                    label="Scope — Modules"
                                    value={scopeModules.length > 0 ? scopeModules.join(", ") : "All modules"}
                                />
                                {groupBy === "perturbation_type" && (
                                    <WizardReviewRow
                                        label="Scope — Perturbation Types"
                                        value={scopePertTypes.length > 0 ? scopePertTypes.join(", ") : "All types"}
                                    />
                                )}
                                {targetThreshold && (
                                    <WizardReviewRow label="Target Threshold" value={targetThreshold} />
                                )}
                                <WizardReviewRow label="Run Selection" value={runSelectionLabel(getRunSelection())} />
                                <WizardReviewRow label="Aggregation" value={aggregationLabel(aggregation)} />
                            </div>
                        </WizardStepPanel>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 bg-muted/20">
                    <Button
                        variant="ghost"
                        onClick={step === 0 ? () => handleOpenChange(false) : handleBack}
                    >
                        {step === 0 ? "Cancel" : "Back"}
                    </Button>

                    {step < STEPS.length - 1 ? (
                        <Button onClick={handleNext} disabled={!canProceed(step)} className="gap-1.5">
                            Next
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    ) : (
                        <Button onClick={handleCreate} disabled={!canProceed(step)} className="gap-1.5 bg-violet-500 hover:bg-violet-600 shadow-lg shadow-violet-500/20">
                            <Sparkles className="h-3.5 w-3.5" />
                            Create Widget
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
