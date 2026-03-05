/**
 * CreateDistributionWidgetModal
 *
 * 4-step wizard for creating a Distribution (pie chart) widget.
 * Steps: Basic Info → Data Configuration → Default Filters → Review & Create
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
import { PieChart, ArrowRight, Sparkles } from "lucide-react"
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
    { label: "Data Config" },
    { label: "Filters" },
    { label: "Review" },
]

// ─── Component ───────────────────────────────────────────────────────────────

interface CreateDistributionWidgetModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreate: (data: { name: string; description: string; definition: WidgetDefinition }) => void
}

export function CreateDistributionWidgetModal({
    open,
    onOpenChange,
    onCreate,
}: CreateDistributionWidgetModalProps) {
    const [step, setStep] = useState(0)

    // Step 1: Basic Info
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")

    // Step 2: Data Config
    const [metric, setMetric] = useState("false_positives")
    const [groupBy, setGroupBy] = useState<GroupBy>("module")
    const [scopeModules, setScopeModules] = useState<string[]>([])
    const [scopePertTypes, setScopePertTypes] = useState<string[]>([])

    // Step 3: Filters
    const [runPreset, setRunPreset] = useState("all")
    const [aggregation, setAggregation] = useState<Aggregation>(null)

    const resetForm = () => {
        setStep(0)
        setTitle("")
        setDescription("")
        setMetric("false_positives")
        setGroupBy("module")
        setScopeModules([])
        setScopePertTypes([])
        setRunPreset("all")
        setAggregation(null)
    }

    const handleOpenChange = (v: boolean) => {
        if (!v) resetForm()
        onOpenChange(v)
    }

    const canProceed = (s: number): boolean => {
        if (s === 0) return title.trim().length > 0
        if (s === 1) return !!metric && !!groupBy
        if (s === 2) return true
        return true
    }

    const handleNext = () => {
        if (step < STEPS.length - 1) setStep(step + 1)
    }

    const handleBack = () => {
        if (step > 0) setStep(step - 1)
    }

    const getRunSelection = (): RunSelection => {
        const preset = RUN_SELECTION_PRESETS.find((p) => p.value === runPreset)
        return preset?.selection ?? { type: "latest", count: 0 }
    }

    const handleCreate = () => {
        const definition: WidgetDefinition = {
            query: {
                runSelection: getRunSelection(),
                scope: {
                    modules: scopeModules,
                    perturbationTypes: scopePertTypes,
                },
                metrics: [metric],
                groupBy,
                aggregation,
            },
        }
        onCreate({ name: title.trim(), description: description.trim(), definition })
        resetForm()
    }

    // Toggle helpers for scope chips
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

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-3xl sm:max-w-3xl p-0 flex flex-col overflow-hidden border border-border/60 bg-card/95 backdrop-blur-xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent px-6 pt-6 pb-4 border-b border-border/40">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                            <PieChart className="h-5 w-5 text-rose-400" />
                            Create Distribution Widget
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground mt-1 text-left">
                            Visualize the proportional share of issues as a pie chart.
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
                                        id="dist-title"
                                        placeholder="e.g. FP Distribution by Module"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="bg-background/60 border-border/50"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <FieldLabel label="Description" hint="optional" />
                                    <Input
                                        id="dist-desc"
                                        placeholder="What does this widget track?"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="bg-background/60 border-border/50"
                                    />
                                </div>
                            </div>
                        </WizardStepPanel>
                    )}

                    {/* Step 2: Data Configuration */}
                    {step === 1 && (
                        <WizardStepPanel title="Data Configuration" description="Choose what data to distribute in the pie chart.">
                            <div className="space-y-5">
                                {/* Metric */}
                                <div>
                                    <FieldLabel label="Metric" required hint="What to measure for each slice" />
                                    <Select value={metric} onValueChange={setMetric}>
                                        <SelectTrigger className="bg-background/60 border-border/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {METRIC_OPTIONS.map((m) => (
                                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Group By */}
                                <div>
                                    <FieldLabel label="Group By" required hint="How to split the pie" />
                                    <Select value={groupBy ?? ""} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                                        <SelectTrigger className="bg-background/60 border-border/50">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
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
                                        <FieldLabel label="Scope — Perturbation Types" hint="empty = all types" />
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
                            </div>
                        </WizardStepPanel>
                    )}

                    {/* Step 3: Default Filters */}
                    {step === 2 && (
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

                    {/* Step 4: Review */}
                    {step === 3 && (
                        <WizardStepPanel title="Review & Create" description="Confirm your widget configuration.">
                            <div className="rounded-xl border border-border/40 bg-background/40 p-4">
                                <WizardReviewRow label="Title" value={title} />
                                <WizardReviewRow label="Description" value={description || "—"} />
                                <WizardReviewRow label="Metric" value={metricLabel(metric)} />
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
                        <Button onClick={handleCreate} disabled={!canProceed(step)} className="gap-1.5 bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/20">
                            <Sparkles className="h-3.5 w-3.5" />
                            Create Widget
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
