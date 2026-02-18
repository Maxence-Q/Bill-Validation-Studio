"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { CheckCircle2, AlertTriangle, ChevronRight, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { renderPrompt } from "@/lib/validation/prompt-builder"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

interface ObservabilityDetailsDialogProps {
    record: ValidationRecord | null
    isOpen: boolean
    onClose: () => void
    template: string
}

export function ObservabilityDetailsDialog({
    record,
    isOpen,
    onClose,
    template
}: ObservabilityDetailsDialogProps) {
    const [activeModule, setActiveModule] = useState<string>("Event")
    const [reconstructedPrompts, setReconstructedPrompts] = useState<Record<string, string> | null>(null)
    const [isReconstructing, setIsReconstructing] = useState(false)
    const [issueFilter, setIssueFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all')
    const [highlightedLine, setHighlightedLine] = useState<number | null>(null)

    // Reset state when record changes
    useEffect(() => {
        if (record) {
            setActiveModule("Event")
            setHighlightedLine(null)
            setReconstructedPrompts(null)

            // Reconstruct if prompts missing but can be reconstructed
            if ((!record.prompts || Object.keys(record.prompts).length === 0) && record.targetEventId && record.referenceIds) {
                reconstructPromptsForRecord(record);
            }
        }
    }, [record])

    // Reset state when module changes
    useEffect(() => {
        setHighlightedLine(null)
    }, [record, activeModule])

    // Scroll to highlighted line when highlighted line changes
    useEffect(() => {
        if (highlightedLine !== null) {
            const timeoutId = setTimeout(() => {
                const lineElement = document.getElementById(`prompt-line-${highlightedLine}`);
                if (lineElement) {
                    lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [highlightedLine, activeModule]);

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

    if (!record) return null

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleString()
    }

    const getCurrentPrompt = () => {
        if (isReconstructing) return "Reconstructing prompts...";

        let modulePrompts = record.prompts?.[activeModule];

        // If not in record, check reconstructed
        if (!modulePrompts && reconstructedPrompts) {
            modulePrompts = reconstructedPrompts[activeModule];
        }

        if (!modulePrompts) return "No prompt for this module"

        const promptsArray = Array.isArray(modulePrompts) ? modulePrompts : [modulePrompts];

        return promptsArray.map((rawPrompt, index) => {
            const promptContent = typeof rawPrompt === 'string'
                ? rawPrompt
                : (typeof rawPrompt === 'object' && rawPrompt !== null && 'content' in rawPrompt)
                    ? (rawPrompt as any).content
                    : JSON.stringify(rawPrompt, null, 2);

            // Legacy check: if it already contains instructions, return as is
            if (typeof rawPrompt === 'string' && rawPrompt.includes("GLOBAL INSTRUCTIONS:")) {
                return rawPrompt;
            }

            // Render full prompt from data
            return renderPrompt(promptContent, template, {
                elementName: `${activeModule} Validation ${promptsArray.length > 1 ? `(Part ${index + 1})` : ""}`,
                targetId: record.eventId.toString(),
                referenceIds: "Validation Record",
                strategy: "Standard Validation"
            });
        }).join("\n\n" + "-".repeat(40) + "\n\n");
    }

    const getModuleIssues = () => {
        let issues = record.issues.filter((issue: any) => issue.module === activeModule);
        if (issueFilter !== 'all') {
            issues = issues.filter((issue: any) => issue.severity === issueFilter);
        }
        return issues;
    }

    const scrollToAttribute = (path: string) => {
        const fullPrompt = getCurrentPrompt();
        const lines = fullPrompt.split('\n');
        const lineIndex = lines.findIndex(line => line.includes(path));

        if (lineIndex !== -1) {
            setHighlightedLine(lineIndex);
        }
    }

    const availableModules = [
        "Event", "EventDates", "OwnerPOS", "FeeDefinitions",
        "Prices", "PriceGroups", "RightToSellAndFees"
    ];

    // Filter available modules to only those that have issues or prompts?
    // Usually we want to show all standard modules.

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton={false} className="max-w-[95vw] sm:max-w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden gap-0">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center shrink-0 bg-muted/20">
                    <div>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            {record.eventName}
                            <Badge variant="outline" className="font-normal text-xs">
                                ID: {record.eventId}
                            </Badge>
                        </DialogTitle>
                        <p className="text-muted-foreground text-sm mt-1">
                            Validated on {formatDate(record.timestamp)}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 mr-4">
                            {(record.issuesCount || 0) > 0 ? (
                                <span className="flex items-center text-destructive font-medium">
                                    <AlertTriangle className="mr-2 h-4 w-4" /> {(record.issuesCount || 0)} Issues Found
                                </span>
                            ) : (
                                <span className="flex items-center text-green-600 font-medium">
                                    <CheckCircle2 className="mr-2 h-4 w-4" /> Validation Passed
                                </span>
                            )}
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <XCircle className="h-6 w-6 text-muted-foreground hover:text-foreground" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar - Modules */}
                    <div className="w-64 border-r bg-muted/10 shrink-0 flex flex-col">
                        <div className="p-2 border-b bg-muted/20 font-medium text-sm">Modules</div>
                        <ScrollArea className="flex-1">
                            <div className="p-2 space-y-1">
                                {availableModules.map(mod => {
                                    const modIssues = record.issues.filter((i: any) => i.module === mod).length;
                                    const hasData = record.prompts?.[mod] || (reconstructedPrompts && reconstructedPrompts[mod]);

                                    return (
                                        <Button
                                            key={mod}
                                            variant={activeModule === mod ? "secondary" : "ghost"}
                                            className={cn(
                                                "w-full justify-between font-normal",
                                                activeModule === mod && "font-medium"
                                            )}
                                            onClick={() => setActiveModule(mod)}
                                        >
                                            <span className="truncate">{mod}</span>
                                            {modIssues > 0 && (
                                                <Badge variant="destructive" className="h-5 px-1.5 min-w-[1.25rem] text-[10px]">
                                                    {modIssues}
                                                </Badge>
                                            )}
                                        </Button>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Middle - Prompt */}
                    <div className="flex-1 flex flex-col border-r min-w-0 overflow-hidden">
                        <div className="p-2 border-b bg-muted/20 font-medium text-sm flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Prompt:</span>
                                <span className="font-bold">{activeModule}</span>
                            </div>
                        </div>
                        <ScrollArea className="h-full w-full">
                            <div className="p-4 min-w-max">
                                <div className="font-mono text-xs text-muted-foreground leading-relaxed whitespace-pre">
                                    {getCurrentPrompt().split('\n').map((line, idx) => (
                                        <div
                                            key={idx}
                                            id={`prompt-line-${idx}`}
                                            className={cn(
                                                "px-1 rounded transition-colors w-fit min-w-full",
                                                highlightedLine === idx ? "bg-primary/20 text-foreground font-medium" : "hover:bg-muted/50"
                                            )}
                                        >
                                            <span className="inline-block w-8 shrink-0 text-muted-foreground/50 select-none mr-2 border-r pr-2 text-right">
                                                {idx + 1}
                                            </span>
                                            {line || " "}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                    </div>

                    {/* Right - Issues */}
                    <div className="w-[400px] flex flex-col shrink-0 bg-background overflow-hidden">
                        <div className="p-2 border-b bg-muted/20 font-medium text-sm shrink-0 flex items-center justify-between">
                            <span>Issues ({getModuleIssues().length})</span>
                            <div className="flex gap-1">
                                {['all', 'error', 'warning', 'info'].map((f) => {
                                    const count = record.issues.filter((i: any) => i.module === activeModule && (f === 'all' || i.severity === f)).length;
                                    return (
                                        <Button
                                            key={f}
                                            variant={issueFilter === f ? "secondary" : "ghost"}
                                            size="sm"
                                            className="h-7 px-2 text-[10px] capitalize"
                                            onClick={() => setIssueFilter(f as any)}
                                            disabled={f !== 'all' && count === 0}
                                        >
                                            {f} {count > 0 && `(${count})`}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                        <ScrollArea className="h-full">
                            <div className="p-4 space-y-4">
                                {getModuleIssues().length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50 text-green-500" />
                                        No issues found for this module.
                                    </div>
                                ) : (
                                    getModuleIssues().map((issue: any, i: number) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "rounded-lg border bg-card text-card-foreground shadow-sm p-3 cursor-pointer transition-colors hover:border-primary/50",
                                                issue.severity === 'error' ? "border-l-4 border-l-destructive" :
                                                    issue.severity === 'warning' ? "border-l-4 border-l-amber-500" :
                                                        "border-l-4 border-l-blue-500"
                                            )}
                                            onClick={() => scrollToAttribute(issue.path)}
                                        >
                                            <div className="flex items-start gap-2 mb-2">
                                                {issue.severity === 'error' ? (
                                                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                                ) : (
                                                    <AlertTriangle className={cn(
                                                        "h-4 w-4 shrink-0 mt-0.5",
                                                        issue.severity === 'warning' ? "text-amber-500" : "text-blue-500"
                                                    )} />
                                                )}
                                                <span className="font-semibold text-sm">Issue {i + 1}: {issue.path}</span>
                                            </div>
                                            <div className="text-sm text-foreground break-words font-medium mb-1">
                                                {issue.severity.toUpperCase()}
                                            </div>
                                            <div className="text-sm text-foreground break-words">
                                                {issue.description || issue.message || JSON.stringify(issue)}
                                            </div>
                                            {issue.suggestion && (
                                                <div className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded">
                                                    <strong>Suggestion:</strong> {issue.suggestion}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
