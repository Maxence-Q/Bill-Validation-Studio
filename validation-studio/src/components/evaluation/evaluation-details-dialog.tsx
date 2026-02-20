"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { CheckCircle2, ArrowRight, Filter, XCircle } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IssuesDisplay } from "@/components/validation/issues-display"
import { cn } from "@/lib/utils"
import { renderPrompt } from "@/lib/validation/prompt-builder"
import { usePromptManager } from "@/components/validation/shared/use-prompt-manager"
import { PromptViewer } from "@/components/validation/shared/prompt-viewer"
import { DialogLayout } from "@/components/validation/shared/dialog-layout"

interface EvaluationDetailsDialogProps {
    record: ValidationRecord | null
    isOpen: boolean
    onClose: () => void
    template: string
}

export function EvaluationDetailsDialog({
    record,
    isOpen,
    onClose,
    template
}: EvaluationDetailsDialogProps) {
    const {
        activeModule,
        setActiveModule,
        promptIndex,
        setPromptIndex,
        isReconstructing,
        groupedPrompts,
        getTotalPromptsCount
    } = usePromptManager(record)

    const [highlightedLine, setHighlightedLine] = useState<number | null>(null)
    const [highlightedIssuePath, setHighlightedIssuePath] = useState<string | null>(null)
    const [scrollToPerturbation, setScrollToPerturbation] = useState<string | null>(null)
    const [perturbationFilter, setPerturbationFilter] = useState<'all' | 'found' | 'not-found'>('all')
    const [classificationFilter, setClassificationFilter] = useState<'all' | 'TP' | 'FP'>('all')

    useEffect(() => {
        if (scrollToPerturbation !== null) {
            const timeoutId = setTimeout(() => {
                const element = document.getElementById(`perturbation-${scrollToPerturbation}`)
                if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "center" })
                    setScrollToPerturbation(null)
                }
            }, 100)
            return () => clearTimeout(timeoutId)
        }
    }, [scrollToPerturbation])

    if (!record) return null

    const getFilteredIssues = () => {
        return record.issues.filter((issue: any) =>
            (issue.module === activeModule) &&
            (issue.itemIndex === undefined || issue.itemIndex === promptIndex) &&
            (classificationFilter === 'all' || issue.classification === classificationFilter)
        )
    }

    const getCurrentPrompt = () => {
        if (isReconstructing) return "Reconstructing prompts..."

        if (groupedPrompts.length === 0) return "No prompt for this module"
        const currentPrompt = groupedPrompts[promptIndex]
        if (!currentPrompt) return "No prompt for this module"

        // If it already contains GLOBAL INSTRUCTIONS, don't run renderPrompt again
        if (currentPrompt.content.includes("GLOBAL INSTRUCTIONS:")) {
            return currentPrompt.content
        }

        return renderPrompt(currentPrompt.content, template, {
            elementName: `${activeModule} Evaluation - Item ${promptIndex + 1}`,
            targetId: (record.eventId || record.targetEventId || "Unknown").toString(),
            referenceIds: "Evaluation Record",
            strategy: "Perturbation Analysis"
        })
    }

    const getCurrentPerturbations = () => {
        const tracking = record.perturbationTracking || (record as any).perturbations
        if (!tracking) return []
        const moduleTrack = tracking[activeModule]
        if (!moduleTrack) return []

        if (Array.isArray(moduleTrack)) {
            const wrapper = moduleTrack.find((p: any) => p.index === promptIndex)
            if (wrapper && Array.isArray(wrapper.details)) {
                return wrapper.details
            }
            if (moduleTrack.length > 0 && 'details' in moduleTrack[0]) {
                return []
            }
            return moduleTrack
        }
        return []
    }

    const findLineForPath = (path: string, promptText: string): number | null => {
        if (!promptText) return null
        let index = promptText.indexOf(path)
        if (index === -1) {
            const parts = path.split('.')
            const leaf = parts[parts.length - 1]
            if (leaf) {
                index = promptText.indexOf(leaf)
            }
        }
        if (index !== -1) {
            return promptText.substring(0, index).split('\n').length - 1
        }
        return null
    }

    const HeaderMetrics = (
        record.metrics && (
            <div className="flex gap-4 text-sm mr-4 border-r pr-4">
                <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Precision</span>
                    <span className="font-bold font-mono">{(record.metrics.precision * 100).toFixed(1)}%</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Recall</span>
                    <span className="font-bold font-mono">{(record.metrics.recall * 100).toFixed(1)}%</span>
                </div>
            </div>
        )
    )

    const TopBarContent = (
        <div className="flex justify-between items-center gap-4 w-full p-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1 px-2">
                {record.prompts && Object.keys(record.prompts).map(module => (
                    <Button
                        key={module}
                        variant={activeModule === module ? "default" : "outline"}
                        size="sm"
                        onClick={() => { setActiveModule(module); setHighlightedLine(null); setHighlightedIssuePath(null); }}
                        className="shrink-0"
                    >
                        {module}
                    </Button>
                ))}
            </div>
            {(() => {
                const modMetrics = record.moduleMetrics?.[activeModule] || (record.metrics as any)?.moduleMetrics?.[activeModule]
                if (!modMetrics) return null

                return (
                    <div className="flex gap-3 text-sm px-3 py-1.5 mr-2 bg-background border rounded-md shadow-sm shrink-0 items-center animate-in fade-in slide-in-from-right-2 duration-300">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Precision</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {(modMetrics.precision * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-px h-3 bg-border"></div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Recall</span>
                            <span className="font-mono font-bold text-violet-600 dark:text-violet-400">
                                {(modMetrics.recall * 100).toFixed(1)}%
                            </span>
                        </div>
                        {(modMetrics.tp !== undefined) && (
                            <>
                                <div className="w-px h-3 bg-border"></div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-muted-foreground">({modMetrics.tp} TP)</span>
                                </div>
                            </>
                        )}
                    </div>
                )
            })()}
        </div>
    )

    const RightContent = (
        <div className="flex h-full min-w-0">
            {/* Middle: Perturbations */}
            <div className="w-1/2 flex flex-col border-r h-full">
                <div className="p-3 border-b bg-muted/10 font-medium text-sm text-muted-foreground flex justify-between items-center">
                    <span>Perturbations Applied ({getCurrentPerturbations().length})</span>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Filter className={cn("h-4 w-4", perturbationFilter !== 'all' ? "text-primary fill-primary/20" : "")} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setPerturbationFilter('all')}>
                                <div className="flex items-center gap-2">
                                    <div className={cn("w-4 h-4 rounded-full border", perturbationFilter === 'all' ? "bg-primary border-primary" : "border-muted-foreground")} />
                                    <span>All</span>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPerturbationFilter('found')}>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    <span className={perturbationFilter === 'found' ? "font-semibold" : ""}>Found</span>
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPerturbationFilter('not-found')}>
                                <div className="flex items-center gap-2">
                                    <XCircle className="h-4 w-4 text-gray-500" />
                                    <span className={perturbationFilter === 'not-found' ? "font-semibold" : ""}>Not found</span>
                                </div>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-0">
                    {(() => {
                        const allPerturbations = getCurrentPerturbations()
                        const issues = getFilteredIssues()

                        const filteredPerturbations = allPerturbations.filter((p: any) => {
                            if (perturbationFilter === 'all') return true
                            const isDetected = issues.some((issue: any) => p.path.trim() === (issue.path || "").trim())
                            if (perturbationFilter === 'found') return isDetected
                            if (perturbationFilter === 'not-found') return !isDetected
                            return true
                        })

                        if (filteredPerturbations.length === 0) {
                            return (
                                <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                                    <span>No perturbations found.</span>
                                    {perturbationFilter !== 'all' && (
                                        <Button variant="link" size="sm" onClick={() => setPerturbationFilter('all')}>
                                            Clear filter
                                        </Button>
                                    )}
                                </div>
                            )
                        }

                        return (
                            <div className="w-full">
                                {filteredPerturbations.map((p: any, idx: number) => {
                                    const isDetected = issues.some((issue: any) => p.path.trim() === (issue.path || "").trim())

                                    return (
                                        <div
                                            key={idx}
                                            id={`perturbation-${p.path.trim()}`}
                                            className="p-4 hover:bg-muted/5 text-sm border-b last:border-0 border-border"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div
                                                    className="font-medium text-sm text-foreground bg-primary/10 px-2 py-0.5 rounded break-all mr-2 cursor-pointer hover:bg-primary/20 hover:underline transition-colors block"
                                                    onClick={() => {
                                                        const promptText = getCurrentPrompt()
                                                        const line = findLineForPath(p.path, promptText)
                                                        if (line !== null) {
                                                            setHighlightedLine(line)
                                                        }
                                                        setHighlightedIssuePath(isDetected ? p.path : null)
                                                    }}
                                                >
                                                    {p.path}
                                                </div>
                                                {isDetected ? (
                                                    <span className="shrink-0 inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                                        Found
                                                    </span>
                                                ) : (
                                                    <span className="shrink-0 inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                                                        Not found
                                                    </span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
                                                <div className="bg-muted/30 text-muted-foreground p-2 rounded text-xs font-mono break-all border border-transparent">
                                                    {p.original === "" ? <span className="italic opacity-50">&lt;empty&gt;</span> : p.original}
                                                </div>
                                                <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                                                <div className="bg-background text-foreground p-2 rounded text-xs font-mono break-all border border-border shadow-sm">
                                                    {p.perturbed === "" ? <span className="italic opacity-50">&lt;empty&gt;</span> : p.perturbed}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })()}
                </div>
            </div>

            {/* Right: Issues */}
            <div className="w-1/2 flex flex-col h-full">
                <div className="p-3 border-b bg-muted/10 font-medium text-sm text-muted-foreground flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <span>Issues Found</span>
                        <div className="flex bg-muted/50 p-0.5 rounded-lg border">
                            {['all', 'TP', 'FP'].map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setClassificationFilter(filter as any)}
                                    className={cn(
                                        "px-2 py-0.5 text-[10px] font-bold uppercase rounded-md transition-all",
                                        classificationFilter === filter
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {filter === 'all' ? 'All' : filter}
                                </button>
                            ))}
                        </div>
                    </div>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full",
                        getFilteredIssues().length > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    )}>
                        {getFilteredIssues().length} issues
                    </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    <IssuesDisplay
                        issues={getFilteredIssues()}
                        highlightedPath={highlightedIssuePath}
                        onIssueClick={(issue) => {
                            const path = issue.path || ""
                            if (!path) return

                            const promptText = getCurrentPrompt()
                            const line = findLineForPath(path, promptText)
                            if (line !== null) {
                                setHighlightedLine(line)
                            }
                            setHighlightedIssuePath(path)

                            if (issue.classification === 'TP') {
                                setScrollToPerturbation(path.trim())
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    )

    return (
        <DialogLayout
            isOpen={isOpen}
            onClose={onClose}
            record={record}
            titlePrefix="Evaluation Details"
            headerMetrics={HeaderMetrics}
            topBarContent={TopBarContent}
            promptIndex={promptIndex}
            totalPrompts={getTotalPromptsCount()}
            onPromptIndexChange={setPromptIndex}
            moduleName={activeModule}
            promptContent={
                <PromptViewer
                    promptText={getCurrentPrompt()}
                    highlightedLine={highlightedLine}
                />
            }
            rightPanelContent={RightContent}
            rightPanelClassName="w-[55%] text-sm"
        />
    )
}
