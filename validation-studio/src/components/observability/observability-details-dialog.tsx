"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { CheckCircle2, AlertTriangle, XCircle, BrainCircuit } from "lucide-react"
import { cn } from "@/lib/utils"
import { renderPrompt } from "@/lib/validation/prompt-builder"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { usePromptManager } from "@/components/validation/shared/use-prompt-manager"
import { PromptViewer } from "@/components/validation/shared/prompt-viewer"
import { ReasoningViewer } from "@/components/validation/shared/reasoning-viewer"
import { DialogLayout } from "@/components/validation/shared/dialog-layout"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { FeedbackModal } from "@/components/feedback/feedback-modal"
import { FeedbackButton } from "@/components/feedback/feedback-button"

interface ObservabilityDetailsDialogProps {
    record: ValidationRecord | null
    isOpen: boolean
    onClose: () => void
}

type ViewMode = 'regular' | 'advanced'

export function ObservabilityDetailsDialog({
    record,
    isOpen,
    onClose,
}: ObservabilityDetailsDialogProps) {
    const {
        activeModule,
        setActiveModule,
        promptIndex,
        setPromptIndex,
        isReconstructing,
        groupedPrompts,
        getTotalPromptsCount,
        reconstructedPrompts
    } = usePromptManager(record)

    const availableModules = useMemo(() => {
        if (!record) return [];
        const moduleSet = new Set<string>();

        // 1. Modules with reasonings (most reliable for successfully processed modules)
        if (record.reasonings) {
            Object.keys(record.reasonings).forEach(m => moduleSet.add(m));
        }

        // 2. Modules with issues (important for failed validations)
        if (record.issues) {
            record.issues.forEach((i: any) => {
                if (i.module) moduleSet.add(i.module);
            });
        }

        // 3. Modules from reconstructed/stored prompts
        const prompts = reconstructedPrompts || record.prompts;
        if (prompts) {
            Object.keys(prompts).forEach(m => moduleSet.add(m));
        }

        // Fallback for UI if everything else failed
        if (moduleSet.size === 0) {
            return [
                "Event", "EventDates", "OwnerPOS", "FeeDefinitions",
                "Prices", "PriceGroups", "RightToSellAndFees"
            ];
        }

        // Return sorted list
        return Array.from(moduleSet).sort();
    }, [record, reconstructedPrompts]);

    // Ensure activeModule is valid
    useEffect(() => {
        if (availableModules.length > 0 && !availableModules.includes(activeModule)) {
            setActiveModule(availableModules[0]);
        }
    }, [availableModules, activeModule, setActiveModule]);

    const [issueFilter, setIssueFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all')
    const [highlightedLine, setHighlightedLine] = useState<number | null>(null)
    const [highlightedReasoningLine, setHighlightedReasoningLine] = useState<number | null>(null)
    const [viewMode, setViewMode] = useState<ViewMode>('regular')
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)

    // List modules that support per-element navigation
    const LIST_MODULES = ["Prices", "PriceGroups", "RightToSellAndFees", "performances", "pricing", "sales_channels"]

    if (!record) return null

    const getCurrentPrompt = () => {
        if (isReconstructing) return "Reconstructing prompts..."

        const safeIndex = Math.min(promptIndex, (groupedPrompts.length || 1) - 1)
        const currentPrompt = groupedPrompts[safeIndex]

        if (!currentPrompt) return "No prompt for this module"

        // If it's already a full prompt (e.g. from reconstruction), return it
        if (currentPrompt.content.includes("--------------------------------------------------") ||
            currentPrompt.content.includes("INSTRUCTIONS:")) {
            return currentPrompt.content
        }

        const label = groupedPrompts.length > 1
            ? `${activeModule} Validation (Element ${safeIndex + 1})`
            : `${activeModule} Validation`

        // Fallback: If for some reason we still have raw data and no template,
        // just show the raw data rather than an empty string.
        return currentPrompt.content;
    }

    const getCurrentReasoning = (): string => {
        const moduleReasonings = record.reasonings?.[activeModule]
        if (!moduleReasonings) return ""
        return moduleReasonings[promptIndex] ?? ""
    }

    const getModuleIssues = () => {
        let issues = record.issues.filter((issue: any) => issue.module === activeModule)

        if (LIST_MODULES.includes(activeModule) && groupedPrompts.length > 1) {
            const safeIndex = Math.min(promptIndex, groupedPrompts.length - 1)
            const currentParentIndex = groupedPrompts[safeIndex]?.parentIndex
            issues = issues.filter((issue: any) => issue.itemIndex === currentParentIndex)
        }

        if (issueFilter !== 'all') {
            issues = issues.filter((issue: any) => issue.severity === issueFilter)
        }
        return issues
    }

    const findLineForPath = (path: string, text: string): number | null => {
        if (!text || !path) return null
        const lines = text.split('\n')

        const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const escapedPath = escapeRegExp(path)
        const regex = new RegExp(`(^|[^a-zA-Z0-9_.])` + escapedPath + `([^a-zA-Z0-9_]|$)`)

        for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) return i
        }

        const fallbackIndex = lines.findIndex(line => line.includes(path))
        if (fallbackIndex !== -1) return fallbackIndex

        const parts = path.split('.')
        const leaf = parts[parts.length - 1]
        if (leaf && leaf !== path) {
            const escapedLeaf = escapeRegExp(leaf)
            const leafRegex = new RegExp(`(^|[^a-zA-Z0-9_.])` + escapedLeaf + `([^a-zA-Z0-9_]|$)`)
            for (let i = 0; i < lines.length; i++) {
                if (leafRegex.test(lines[i])) return i
            }
            const fallbackLeafIndex = lines.findIndex(line => line.includes(leaf))
            if (fallbackLeafIndex !== -1) return fallbackLeafIndex
        }

        return null
    }

    const scrollToAttribute = (path: string) => {
        if (!path) {
            setHighlightedLine(null)
            setHighlightedReasoningLine(null)
            return
        }

        setHighlightedLine(findLineForPath(path, getCurrentPrompt()))
        setHighlightedReasoningLine(findLineForPath(path, getCurrentReasoning()))
    }

    const totalPrompts = getTotalPromptsCount()

    // --- Shared sub-elements ---

    const ViewToggle = (
        <div className="flex items-center gap-3">
            <div className="flex items-center bg-muted/60 rounded-lg p-0.5 border text-xs gap-0.5">
                {(['regular', 'advanced'] as ViewMode[]).map(mode => (
                    <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={cn(
                            "px-3 py-1 rounded-md font-medium capitalize transition-all",
                            viewMode === mode
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {mode === 'advanced' && <BrainCircuit className="inline h-3 w-3 mr-1 mb-0.5" />}
                        {mode}
                    </button>
                ))}
            </div>
            <FeedbackButton onClick={() => setIsFeedbackOpen(true)} />
        </div>
    )

    const HeaderMetrics = (
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
    )

    const SidebarContent = (
        <>
            <div className="p-2 border-b bg-muted/20 font-medium text-sm shrink-0">Modules</div>
            <ScrollArea className="flex-1 h-full min-h-0">
                <div className="p-2 space-y-1">
                    {availableModules.map(mod => {
                        const modIssues = record.issues.filter((i: any) => i.module === mod).length
                        return (
                            <Button
                                key={mod}
                                variant={activeModule === mod ? "secondary" : "ghost"}
                                className={cn(
                                    "w-full justify-between font-normal",
                                    activeModule === mod && "font-medium"
                                )}
                                onClick={() => { setActiveModule(mod); setHighlightedLine(null); setHighlightedReasoningLine(null); }}
                            >
                                <span className="truncate">{mod}</span>
                                {modIssues > 0 && (
                                    <Badge variant="destructive" className="h-5 px-1.5 min-w-[1.25rem] text-[10px]">
                                        {modIssues}
                                    </Badge>
                                )}
                            </Button>
                        )
                    })}
                </div>
            </ScrollArea>
        </>
    )

    const IssuesPanel = (
        <>
            <div className="p-2 border-b bg-muted/20 font-medium text-sm shrink-0 flex items-center justify-between">
                <span>Issues ({getModuleIssues().length})</span>
                <div className="flex gap-1">
                    {['all', 'error', 'warning', 'info'].map((f) => {
                        const count = record.issues.filter((i: any) => i.module === activeModule && (f === 'all' || i.severity === f)).length
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
                        )
                    })}
                </div>
            </div>
            <ScrollArea className="flex-1 h-full min-h-0">
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
                                <div className="flex items-start gap-2 mb-2 w-full min-w-0">
                                    {issue.severity === 'error' ? (
                                        <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                                    ) : (
                                        <AlertTriangle className={cn(
                                            "h-4 w-4 shrink-0 mt-0.5",
                                            issue.severity === 'warning' ? "text-amber-500" : "text-blue-500"
                                        )} />
                                    )}
                                    <span className="font-semibold text-sm break-all">Issue {i + 1}: {issue.path}</span>
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
        </>
    )

    // --- Advanced view ---
    if (viewMode === 'advanced') {
        const PaginationControls = totalPrompts > 1 && (
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7"
                    disabled={promptIndex === 0}
                    onClick={() => setPromptIndex(promptIndex - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs tabular-nums min-w-[4rem] text-center">
                    {promptIndex + 1} of {totalPrompts}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7"
                    disabled={promptIndex >= totalPrompts - 1}
                    onClick={() => setPromptIndex(promptIndex + 1)}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        )

        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent showCloseButton={false} className="max-w-[98vw] sm:max-w-[98vw] w-[98vw] h-[92vh] p-0 flex flex-col overflow-hidden gap-0">
                    {/* Header */}
                    <div className="p-4 border-b flex justify-between items-center shrink-0 bg-muted/20 relative">
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                {record.eventName}
                                <Badge variant="outline" className="font-normal text-xs">
                                    ID: {record.eventId || record.targetEventId || "Unknown"}
                                </Badge>
                            </DialogTitle>
                            <p className="text-muted-foreground text-sm mt-1">
                                {new Date(record.timestamp).toLocaleString()}
                            </p>
                        </div>
                        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
                            {ViewToggle}
                        </div>
                        <div className="flex items-center gap-3">
                            {HeaderMetrics}
                            <Button variant="ghost" size="icon" onClick={onClose}>
                                <XCircle className="h-6 w-6 text-muted-foreground hover:text-foreground" />
                            </Button>
                        </div>
                    </div>

                    {isFeedbackOpen && (
                        <FeedbackModal
                            isOpen={isFeedbackOpen}
                            onClose={() => setIsFeedbackOpen(false)}
                            record={record}
                            type="validation"
                        />
                    )}

                    {/* Content: sidebar + 3 equal columns */}
                    <div className="flex flex-1 w-full overflow-hidden">
                        {/* Sidebar */}
                        <div className="w-48 border-r bg-muted/10 shrink-0 flex flex-col h-full min-h-0">
                            {SidebarContent}
                        </div>

                        {/* 3-column area */}
                        <div className="flex flex-1 w-full overflow-hidden">
                            {/* Prompt */}
                            <div className="flex-1 flex flex-col border-r min-w-0 overflow-hidden h-full min-h-0">
                                <div className="p-2 border-b bg-muted/10 font-medium text-sm flex justify-between items-center shrink-0 min-h-[44px]">
                                    <div className="flex items-center gap-2 px-2">
                                        <span className="text-muted-foreground">Prompt:</span>
                                        <span className="font-bold">{activeModule}</span>
                                    </div>
                                    {PaginationControls}
                                </div>
                                <PromptViewer promptText={getCurrentPrompt()} highlightedLine={highlightedLine} />
                            </div>

                            {/* Reasoning */}
                            <div className="flex-1 flex flex-col border-r min-w-0 overflow-hidden h-full min-h-0">
                                <div className="p-2 border-b bg-muted/10 font-medium text-sm flex items-center gap-2 shrink-0 min-h-[44px] px-4">
                                    <BrainCircuit className="h-4 w-4 text-muted-foreground" />
                                    <span>Reasoning</span>
                                </div>
                                <ReasoningViewer reasoning={getCurrentReasoning()} highlightedLine={highlightedReasoningLine} />
                            </div>

                            {/* Issues */}
                            <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full min-h-0 text-sm">
                                {IssuesPanel}
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    // --- Regular view ---
    return (
        <>
            <DialogLayout
                isOpen={isOpen}
                onClose={onClose}
                record={record}
                headerMetrics={HeaderMetrics}
                viewToggle={ViewToggle}
                sidebarContent={SidebarContent}
                promptIndex={promptIndex}
                totalPrompts={totalPrompts}
                onPromptIndexChange={setPromptIndex}
                moduleName={activeModule}
                promptContent={
                    <PromptViewer
                        promptText={getCurrentPrompt()}
                        highlightedLine={highlightedLine}
                    />
                }
                rightPanelContent={IssuesPanel}
            />
            {isFeedbackOpen && (
                <FeedbackModal
                    isOpen={isFeedbackOpen}
                    onClose={() => setIsFeedbackOpen(false)}
                    record={record}
                    type="validation"
                />
            )}
        </>
    )
}
