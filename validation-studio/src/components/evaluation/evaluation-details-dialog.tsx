"use client"

import { useState, useEffect, useMemo } from "react"
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
import { renderPrompt } from "@/lib/validation/prompt-builder"

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
    const [activeModule, setActiveModule] = useState<string>("Event")
    const [promptIndex, setPromptIndex] = useState(0)
    const [reconstructedPrompts, setReconstructedPrompts] = useState<Record<string, any[]> | null>(null)
    const [isReconstructing, setIsReconstructing] = useState(false)

    // Logically group prompts by their parentIndex to handle sub-prompts (slicing)
    const groupedPrompts = useMemo(() => {
        if (!record) return [];
        let modulePrompts = record.prompts?.[activeModule];
        if (!modulePrompts && reconstructedPrompts) {
            modulePrompts = reconstructedPrompts[activeModule];
        }

        if (!modulePrompts) return [];

        if (!Array.isArray(modulePrompts)) {
            return [[modulePrompts]];
        }

        // Check if it's an array of objects with slicing metadata (new format)
        if (modulePrompts.length > 0 && typeof modulePrompts[0] === 'object' && 'slicingMetadata' in modulePrompts[0]) {
            const groups: any[][] = [];
            modulePrompts.forEach((p: any) => {
                const pIdx = p.slicingMetadata.parentIndex;
                if (!groups[pIdx]) groups[pIdx] = [];
                groups[pIdx].push(p);
            });
            // Return only valid groups
            return groups.filter(g => g && g.length > 0);
        }

        // Legacy format: string array or simple objects, treat each as one group
        return modulePrompts.map(p => [p]);
    }, [record, activeModule, reconstructedPrompts]);

    // Reset state when record changes
    useEffect(() => {
        if (record) {
            setActiveModule("Event")
            setPromptIndex(0)
            setReconstructedPrompts(null)

            // Reconstruct if prompts missing but can be reconstructed
            if ((!record.prompts || Object.keys(record.prompts).length === 0) && record.targetEventId && record.referenceIds) {
                reconstructPromptsForRecord(record);
            }
        }
    }, [record])

    const reconstructPromptsForRecord = async (rec: ValidationRecord) => {
        setIsReconstructing(true);
        try {
            const res = await fetch('/api/validation/reconstruct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetEventId: rec.targetEventId,
                    referenceIds: rec.referenceIds,
                    config: rec.config,
                    perturbationConfig: rec.perturbationConfig
                })
            });
            if (res.ok) {
                const data = await res.json();
                setReconstructedPrompts(data.prompts);
            } else {
                console.error("Failed to reconstruct prompts");
            }
        } catch (e) {
            console.error("Error reconstructing prompts", e);
        } finally {
            setIsReconstructing(false);
        }
    }

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
        if (isReconstructing) return "Reconstructing prompts...";

        const group = groupedPrompts[promptIndex];
        if (!group || group.length === 0) return "No prompt for this module";

        // Join all sub-prompts in this group
        return group.map((rawPrompt: any, idx: number) => {
            const promptContent = typeof rawPrompt === 'string'
                ? rawPrompt
                : (rawPrompt.content || rawPrompt.rendered || JSON.stringify(rawPrompt, null, 2));

            // Legacy check: if it already contains instructions, return as is
            if (typeof promptContent === 'string' && promptContent.includes("GLOBAL INSTRUCTIONS:")) {
                return promptContent;
            }

            // Render full prompt from data
            return renderPrompt(promptContent, template, {
                elementName: `${activeModule} Evaluation - Item ${promptIndex + 1}${group.length > 1 ? ` (Part ${idx + 1}/${group.length})` : ""}`,
                targetId: (record.eventId || record.targetEventId || "Unknown").toString(),
                referenceIds: "Evaluation Record",
                strategy: "Perturbation Analysis"
            });
        }).join("\n\n" + "=".repeat(50) + "\n\n");
    }

    const getTotalPrompts = () => {
        return groupedPrompts.length;
    }

    const getCurrentPerturbations = () => {
        // ValidationRecord was updated to have perturbationTracking
        const tracking = record.perturbationTracking || (record as any).perturbations;

        if (!tracking) return []
        const moduleTrack = tracking[activeModule]
        if (!moduleTrack) return []

        // Handle structure differences
        if (Array.isArray(moduleTrack)) {
            // New format: flattened or indexed differently?
            // Orchestrator stores `allPerturbationTracking[mod] = [{ index, details: [...] }]`
            // So we find the item for current promptIndex
            const wrapper = moduleTrack.find((p: any) => p.index === promptIndex);
            // If wrapper found, return its details array.
            // If not found, check if moduleTrack itself is directly an array of perturbations (legacy/simple format)
            if (wrapper && Array.isArray(wrapper.details)) {
                return wrapper.details;
            }

            // Fallback: If no wrapper structure matched, maybe it's just the array itself (or empty)
            // But let's be careful not to return the wrapper array if it doesn't match the expected shape of perturbation item
            // A perturbation item usually has { path, original, perturbed }
            // A wrapper has { index, details }
            // If the first item has 'details', it's definitely a wrapper list.
            if (moduleTrack.length > 0 && 'details' in moduleTrack[0]) {
                return []; // Found wrappers but no match for index
            }

            return moduleTrack;
        }
        return []
    }

    // Helper to check if prompts are array (to decide perturbation indexing)
    const modulePromptsIsArray = Array.isArray(record.prompts?.[activeModule] || reconstructedPrompts?.[activeModule]);

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
                            {record.eventName} (ID: {record.eventId || record.targetEventId || "Unknown"}) - {formatDate(record.timestamp)}
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
                        {(() => {
                            const modMetrics = record.moduleMetrics?.[activeModule] || (record.metrics as any)?.moduleMetrics?.[activeModule];
                            if (!modMetrics) return null;

                            return (
                                <div className="flex gap-3 text-sm px-3 py-1.5 bg-background border rounded-md shadow-sm shrink-0 items-center animate-in fade-in slide-in-from-right-2 duration-300">
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
                            );
                        })()}
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
                                        // Strict matching to align with MetricsCalculator
                                        return p.path.trim() === issuePath.trim();
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
                                                // Strict matching to align with MetricsCalculator
                                                return p.path.trim() === issuePath.trim();
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
