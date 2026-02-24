import { ReactNode } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { Badge } from "@/components/ui/badge"
import { XCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface DialogLayoutProps {
    isOpen: boolean
    onClose: () => void
    record: ValidationRecord
    titlePrefix?: string
    headerMetrics?: ReactNode // Custom metrics/badges for top right
    viewToggle?: ReactNode    // Optional Regular/Advanced toggle rendered in the header
    topBarContent?: ReactNode // Optional top bar spanning full width below header
    sidebarContent?: ReactNode // Optional left sidebar
    promptHeaderContent?: ReactNode // Optional header for middle section
    promptContent: ReactNode // Middle section
    rightPanelContent: ReactNode // Right section (Issues/Perturbations)
    rightPanelClassName?: string // Optional custom class for right panel width
    // Pagination props for prompt header shortcut
    promptIndex?: number
    totalPrompts?: number
    onPromptIndexChange?: (newIndex: number) => void
    moduleName?: string
}

export function DialogLayout({
    isOpen,
    onClose,
    record,
    titlePrefix = "",
    headerMetrics,
    viewToggle,
    topBarContent,
    sidebarContent,
    promptHeaderContent,
    promptContent,
    rightPanelContent,
    rightPanelClassName,
    promptIndex,
    totalPrompts,
    onPromptIndexChange,
    moduleName
}: DialogLayoutProps) {
    if (!record) return null

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleString()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent showCloseButton={false} className="max-w-[95vw] sm:max-w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden gap-0">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center shrink-0 bg-muted/20 relative">
                    <div>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            {titlePrefix && <span className="mr-1">{titlePrefix}</span>}
                            {record.eventName}
                            <Badge variant="outline" className="font-normal text-xs">
                                ID: {record.eventId || record.targetEventId || "Unknown"}
                            </Badge>
                        </DialogTitle>
                        <p className="text-muted-foreground text-sm mt-1">
                            {formatDate(record.timestamp)}
                        </p>
                    </div>
                    {viewToggle && (
                        <div className="absolute left-1/2 -translate-x-1/2">
                            {viewToggle}
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        {headerMetrics}
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <XCircle className="h-6 w-6 text-muted-foreground hover:text-foreground" />
                        </Button>
                    </div>
                </div>

                {topBarContent && (
                    <div className="border-b bg-muted/10 shrink-0 w-full">
                        {topBarContent}
                    </div>
                )}

                {/* Content Layout */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Optional Left Sidebar */}
                    {sidebarContent && (
                        <div className="w-64 border-r bg-muted/10 shrink-0 flex flex-col h-full min-h-0">
                            {sidebarContent}
                        </div>
                    )}

                    {/* Middle - Prompt Area */}
                    <div className="flex-1 flex flex-col border-r min-w-0 overflow-hidden h-full min-h-0">
                        <div className="p-2 border-b bg-muted/10 font-medium text-sm flex justify-between items-center shrink-0 min-h-[44px]">
                            {promptHeaderContent ? (
                                promptHeaderContent
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 px-2">
                                        <span className="text-muted-foreground">Prompt:</span>
                                        <span className="font-bold">{moduleName || "Unknown"}</span>
                                    </div>
                                    {(totalPrompts ?? 0) > 1 && onPromptIndexChange && promptIndex !== undefined && (
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                disabled={promptIndex === 0}
                                                onClick={() => onPromptIndexChange(promptIndex - 1)}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <span className="text-xs tabular-nums min-w-[4rem] text-center">
                                                {promptIndex + 1} of {totalPrompts}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                disabled={promptIndex >= (totalPrompts ?? 0) - 1}
                                                onClick={() => onPromptIndexChange(promptIndex + 1)}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        {promptContent}
                    </div>

                    {/* Right Panel */}
                    <div className={cn("flex flex-col shrink-0 bg-background overflow-hidden h-full min-h-0", rightPanelClassName || (sidebarContent ? "w-[400px]" : "w-[40%] text-sm"))}>
                        {rightPanelContent}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
