"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { CheckCircle2, ArrowRight, ChevronLeft, ChevronRight, Filter, XCircle } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { IssuesDisplay } from "@/components/validation/issues-display"
import { cn } from "@/lib/utils"

interface EvaluationDetailsDialogProps {
    record: ValidationRecord | null
    isOpen: boolean
    onClose: () => void
}

export function EvaluationDetailsDialog({
    record,
    isOpen,
    onClose
}: EvaluationDetailsDialogProps) {
    const [activeModule, setActiveModule] = useState<string>("Event")
    const [promptIndex, setPromptIndex] = useState(0)

    // Reset state when record changes
    useEffect(() => {
        if (record) {
            setActiveModule("Event")
            setPromptIndex(0)
        }
    }, [record])

    const [highlightedLine, setHighlightedLine] = useState<number | null>(null)
    const [highlightedIssuePath, setHighlightedIssuePath] = useState<string | null>(null)
    const [scrollToLine, setScrollToLine] = useState<number | null>(null)
    const [perturbationFilter, setPerturbationFilter] = useState<'all' | 'found' | 'not-found'>('all')
    const [classificationFilter, setClassificationFilter] = useState<'all' | 'TP' | 'FP'>('all')

    // Scroll to highlighted line
    useEffect(() => {
        if (scrollToLine !== null) {
            const element = document.getElementById(`prompt-line-${scrollToLine}`)
            if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "center" })
                setScrollToLine(null)
            }
        }
    }, [scrollToLine])

    if (!record) return null

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleString()
    }

    const getFilteredIssues = () => {
        return record.issues.filter((issue: any) =>
            (issue.module === activeModule) &&
            (issue.itemIndex === undefined || issue.itemIndex === promptIndex) &&
            (classificationFilter === 'all' || issue.classification === classificationFilter)
        )
    }

    const getCurrentPrompt = () => {
        if (!record.prompts) return "No Prompt Data"
        const modulePrompts = record.prompts[activeModule]
        if (!modulePrompts) return "No prompt for this module"
        return Array.isArray(modulePrompts) ? modulePrompts[promptIndex] : JSON.stringify(modulePrompts, null, 2)
    }

    const getTotalPrompts = () => {
        if (!record.prompts) return 0
        const modulePrompts = record.prompts[activeModule]
        return Array.isArray(modulePrompts) ? modulePrompts.length : 1
    }

    const getCurrentPerturbations = () => {
        if (!record.perturbations) return []
        const modulePerturbations = record.perturbations[activeModule]
        if (!modulePerturbations || !Array.isArray(modulePerturbations)) return []
        return modulePerturbations[promptIndex] || []
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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton={false} className="max-w-[95vw] sm:max-w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden gap-0">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center shrink-0">
                    <div>
                        <DialogTitle className="text-xl font-bold">Evaluation Details</DialogTitle>
                        <p className="text-muted-foreground text-sm">
                            {record.eventName} (ID: {record.eventId}) - {formatDate(record.timestamp)}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {record.metrics && (
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
                        )}
                        <Button variant="ghost" onClick={onClose}>Close</Button>
                    </div>
                </div>

                {/* Controls */}
                <div className="border-b bg-muted/30 p-2 flex flex-col gap-2 shrink-0">
                    {/* Module Selector + Metrics */}
                    <div className="flex justify-between items-center gap-4">
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide flex-1">
                            {record.prompts && Object.keys(record.prompts).map(module => (
                                <Button
                                    key={module}
                                    variant={activeModule === module ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => { setActiveModule(module); setPromptIndex(0); }}
                                    className="shrink-0"
                                >
                                    {module}
                                </Button>
                            ))}
                        </div>

                        {/* Active Module Metrics */}
                        {record.moduleMetrics?.[activeModule] && (
                            <div className="flex gap-3 text-sm px-3 py-1.5 bg-background border rounded-md shadow-sm shrink-0 items-center">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Precision</span>
                                    <span className="font-mono font-medium">
                                        {(record.moduleMetrics[activeModule].precision * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <div className="w-px h-3 bg-border"></div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Recall</span>
                                    <span className="font-mono font-medium">
                                        {(record.moduleMetrics[activeModule].recall * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pagination (if needed) */}
                    {getTotalPrompts() > 1 && (
                        <div className="flex items-center justify-center gap-4 py-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={promptIndex === 0}
                                onClick={() => setPromptIndex(prev => prev - 1)}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-medium">
                                Prompt {promptIndex + 1} of {getTotalPrompts()}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={promptIndex >= getTotalPrompts() - 1}
                                onClick={() => setPromptIndex(prev => prev + 1)}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Split View */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Prompt */}
                    <div className="w-[30%] flex flex-col border-r h-full">
                        <div className="p-3 border-b bg-muted/10 font-medium text-sm text-muted-foreground shrink-0">
                            Prompt Content
                        </div>
                        <div className="flex-1 overflow-auto p-4 bg-muted/5 font-mono text-xs whitespace-pre">
                            {getCurrentPrompt().split('\n').map((line: string, i: number) => (
                                <div
                                    key={i}
                                    id={`prompt-line-${i}`}
                                    className={cn(
                                        "px-1 min-h-[1.2em]",
                                        highlightedLine === i && "bg-yellow-200/50 dark:bg-yellow-900/50 rounded"
                                    )}
                                >
                                    {line}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Middle: Perturbations */}
                    <div className="w-[30%] flex flex-col border-r">
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
                        <div className="flex-1 overflow-auto p-0">
                            {(() => {
                                const allPerturbations = getCurrentPerturbations();
                                const issues = getFilteredIssues();

                                const filteredPerturbations = allPerturbations.filter((p: any) => {
                                    if (perturbationFilter === 'all') return true;

                                    const isDetected = issues.some((issue: any) => {
                                        const issuePath = issue.path || "";
                                        return p.path === issuePath || issuePath.includes(p.path) || p.path.includes(issuePath);
                                    });

                                    if (perturbationFilter === 'found') return isDetected;
                                    if (perturbationFilter === 'not-found') return !isDetected;
                                    return true;
                                });

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
                                    <div>
                                        {filteredPerturbations.map((p: any, idx: number) => {
                                            // Detection Logic
                                            const issues = getFilteredIssues();
                                            const isDetected = issues.some((issue: any) => {
                                                const issuePath = issue.path || "";
                                                return p.path === issuePath || issuePath.includes(p.path) || p.path.includes(issuePath);
                                            });

                                            return (
                                                <div key={idx} className="p-4 hover:bg-muted/5 text-sm border-b last:border-0 border-border">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div
                                                            className="font-medium text-sm text-foreground bg-primary/10 px-2 py-0.5 rounded break-all mr-2 cursor-pointer hover:bg-primary/20 hover:underline transition-colors block"
                                                            onClick={() => {
                                                                const promptText = getCurrentPrompt();
                                                                const line = findLineForPath(p.path, promptText);
                                                                if (line !== null) {
                                                                    setHighlightedLine(line);
                                                                    setScrollToLine(line);
                                                                }

                                                                // If detected, highlight the corresponding issue
                                                                if (isDetected) {
                                                                    setHighlightedIssuePath(p.path);
                                                                } else {
                                                                    setHighlightedIssuePath(null);
                                                                }
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
                    <div className="w-[40%] flex flex-col">
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
                        <div className="flex-1 overflow-auto p-4">
                            <IssuesDisplay issues={getFilteredIssues()} highlightedPath={highlightedIssuePath} />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
