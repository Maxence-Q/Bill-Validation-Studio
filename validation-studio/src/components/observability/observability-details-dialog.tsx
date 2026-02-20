"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { renderPrompt } from "@/lib/validation/prompt-builder"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { usePromptManager } from "@/components/validation/shared/use-prompt-manager"
import { PromptViewer } from "@/components/validation/shared/prompt-viewer"
import { DialogLayout } from "@/components/validation/shared/dialog-layout"

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
    const {
        activeModule,
        setActiveModule,
        promptIndex,
        setPromptIndex,
        isReconstructing,
        groupedPrompts,
        getTotalPromptsCount
    } = usePromptManager(record)

    const [issueFilter, setIssueFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all')
    const [highlightedLine, setHighlightedLine] = useState<number | null>(null)

    // List modules that support per-element navigation
    const LIST_MODULES = ["Prices", "PriceGroups", "RightToSellAndFees"]

    if (!record) return null

    const getCurrentPrompt = () => {
        if (isReconstructing) return "Reconstructing prompts..."
        if (groupedPrompts.length === 0) return "No prompt for this module"

        const safeIndex = Math.min(promptIndex, groupedPrompts.length - 1)
        const currentPrompt = groupedPrompts[safeIndex]
        if (!currentPrompt) return "No prompt for this module"

        if (currentPrompt.content.includes("GLOBAL INSTRUCTIONS:")) {
            return currentPrompt.content
        }

        const label = groupedPrompts.length > 1
            ? `${activeModule} Validation (Element ${safeIndex + 1})`
            : `${activeModule} Validation`

        return renderPrompt(currentPrompt.content, template, {
            elementName: label,
            targetId: record.eventId.toString(),
            referenceIds: "Validation Record",
            strategy: "Standard Validation"
        })
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

    const scrollToAttribute = (path: string) => {
        const fullPrompt = getCurrentPrompt()
        const lines = fullPrompt.split('\n')
        const lineIndex = lines.findIndex(line => line.includes(path))

        if (lineIndex !== -1) {
            setHighlightedLine(lineIndex)
        }
    }

    const availableModules = [
        "Event", "EventDates", "OwnerPOS", "FeeDefinitions",
        "Prices", "PriceGroups", "RightToSellAndFees"
    ]

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
                                onClick={() => { setActiveModule(mod); setHighlightedLine(null); }}
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

    const RightContent = (
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
        </>
    )

    return (
        <DialogLayout
            isOpen={isOpen}
            onClose={onClose}
            record={record}
            headerMetrics={HeaderMetrics}
            sidebarContent={SidebarContent}
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
        />
    )
}
