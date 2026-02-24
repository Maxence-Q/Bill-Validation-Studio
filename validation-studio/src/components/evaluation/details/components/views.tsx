import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BrainCircuit, ChevronLeft, ChevronRight, XCircle } from "lucide-react"
import { PromptViewer } from "@/components/validation/shared/prompt-viewer"
import { ReasoningViewer } from "@/components/validation/shared/reasoning-viewer"
import { DialogLayout } from "@/components/validation/shared/dialog-layout"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { EvaluationDialogLogic, ViewMode } from "../types"
import { MetricsHeader } from "./top-bar"

interface ViewToggleProps {
    viewMode: ViewMode
    setViewMode: (mode: ViewMode) => void
}

export function ViewToggle({ viewMode, setViewMode }: ViewToggleProps) {
    return (
        <div className="flex items-center bg-muted/60 rounded-lg p-0.5 border text-xs gap-0.5">
            {(['regular', 'advanced'] as ViewMode[]).map(mode => (
                <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={mode === viewMode
                        ? "px-3 py-1 rounded-md font-medium capitalize transition-all bg-background text-foreground shadow-sm"
                        : "px-3 py-1 rounded-md font-medium capitalize transition-all text-muted-foreground hover:text-foreground"
                    }
                >
                    {mode === 'advanced' && <BrainCircuit className="inline h-3 w-3 mr-1 mb-0.5" />}
                    {mode}
                </button>
            ))}
        </div>
    )
}

interface PaginationProps {
    currentIndex: number
    total: number
    onNext: () => void
    onPrev: () => void
}

export function Pagination({ currentIndex, total, onNext, onPrev }: PaginationProps) {
    if (total <= 1) return null

    return (
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7"
                disabled={currentIndex === 0}
                onClick={onPrev}>
                <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs tabular-nums min-w-[4rem] text-center">
                {currentIndex + 1} of {total}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7"
                disabled={currentIndex >= total - 1}
                onClick={onNext}>
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
    )
}

interface AdvancedViewProps {
    isOpen: boolean
    onClose: () => void
    record: ValidationRecord
    logic: EvaluationDialogLogic
    TopBar: React.ReactNode
    IssuesPanel: React.ReactNode
}

export function AdvancedView({
    isOpen,
    onClose,
    record,
    logic,
    TopBar,
    IssuesPanel
}: AdvancedViewProps) {
    const {
        viewMode,
        setViewMode,
        promptIndex,
        setPromptIndex,
        totalPrompts,
        activeModule,
        getCurrentPrompt,
        getCurrentReasoning,
        highlightedLine,
        setHighlightedLine
    } = logic

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton={false} className="max-w-[95vw] sm:max-w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden gap-0">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center shrink-0 bg-muted/20">
                    <div>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            Evaluation Details {record.eventName}
                            <Badge variant="outline" className="font-normal text-xs">
                                ID: {record.eventId || record.targetEventId || "Unknown"}
                            </Badge>
                        </DialogTitle>
                        <p className="text-muted-foreground text-sm mt-1">
                            {new Date(record.timestamp).toLocaleString()}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <MetricsHeader record={record} />
                        <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <XCircle className="h-6 w-6 text-muted-foreground hover:text-foreground" />
                        </Button>
                    </div>
                </div>

                {/* Module tabs */}
                <div className="border-b bg-muted/10 shrink-0 w-full">
                    {TopBar}
                </div>

                {/* 3-column content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Prompt */}
                    <div className="flex-1 flex flex-col border-r min-w-0 overflow-hidden h-full min-h-0">
                        <div className="p-2 border-b bg-muted/10 font-medium text-sm flex justify-between items-center shrink-0 min-h-[44px]">
                            <div className="flex items-center gap-2 px-2">
                                <span className="text-muted-foreground">Prompt:</span>
                                <span className="font-bold">{activeModule}</span>
                            </div>
                            <Pagination
                                currentIndex={promptIndex}
                                total={totalPrompts}
                                onNext={() => { setPromptIndex(promptIndex + 1); setHighlightedLine(null) }}
                                onPrev={() => { setPromptIndex(promptIndex - 1); setHighlightedLine(null) }}
                            />
                        </div>
                        <PromptViewer promptText={getCurrentPrompt()} highlightedLine={highlightedLine} />
                    </div>

                    {/* Reasoning */}
                    <div className="flex-1 flex flex-col border-r min-w-0 overflow-hidden h-full min-h-0">
                        <div className="p-2 border-b bg-muted/10 font-medium text-sm flex items-center gap-2 shrink-0 min-h-[44px] px-4">
                            <BrainCircuit className="h-4 w-4 text-muted-foreground" />
                            <span>Reasoning</span>
                        </div>
                        <ReasoningViewer reasoning={getCurrentReasoning()} />
                    </div>

                    {/* Issues */}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden h-full min-h-0 text-sm">
                        {IssuesPanel}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

interface RegularViewProps {
    isOpen: boolean
    onClose: () => void
    record: ValidationRecord
    logic: EvaluationDialogLogic
    TopBar: React.ReactNode
    RightContent: React.ReactNode
}

export function RegularView({
    isOpen,
    onClose,
    record,
    logic,
    TopBar,
    RightContent
}: RegularViewProps) {
    const {
        viewMode,
        setViewMode,
        promptIndex,
        totalPrompts,
        setPromptIndex,
        activeModule,
        getCurrentPrompt,
        highlightedLine
    } = logic

    return (
        <DialogLayout
            isOpen={isOpen}
            onClose={onClose}
            record={record}
            titlePrefix="Evaluation Details"
            headerMetrics={<MetricsHeader record={record} />}
            viewToggle={<ViewToggle viewMode={viewMode} setViewMode={setViewMode} />}
            topBarContent={TopBar}
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
            rightPanelContent={RightContent}
            rightPanelClassName="w-[55%] text-sm"
        />
    )
}
