import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { ValidationIssue } from "@/types/validation"
import { IssueCard } from "./issue-card"
import { ListModuleIssuesProps } from "./types"

export function ListModuleIssues({ issues, feedbackMap, onAction }: ListModuleIssuesProps) {
    // Group issues by itemIndex
    const grouped = new Map<number, ValidationIssue[]>()
    for (const issue of issues) {
        const idx = issue.itemIndex ?? 0
        const id = issue.issueId || `${issue.module}-${issue.message.slice(0, 30)}`
        // Skip dismissed issues
        if (feedbackMap[id] === 'dismissed') continue
        if (!grouped.has(idx)) grouped.set(idx, [])
        grouped.get(idx)!.push(issue)
    }
    const sortedIndices = Array.from(grouped.keys()).sort((a, b) => a - b)

    const [page, setPage] = useState(0)
    const totalPages = sortedIndices.length
    const currentIndex = sortedIndices[page]
    const currentIssues = grouped.get(currentIndex) || []

    const currentErrors = currentIssues.filter(i => i.severity === "error").length
    const currentWarnings = currentIssues.filter(i => i.severity === "warning").length
    const currentInfos = currentIssues.filter(i => i.severity === "info").length

    if (totalPages === 0) return null

    return (
        <div className="space-y-3">
            {/* Navigation bar */}
            <div className="flex items-center justify-between bg-background/80 rounded-lg px-3 py-2 border border-border/60">
                <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className={cn(
                        "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all",
                        page === 0
                            ? "text-muted-foreground/30 cursor-not-allowed"
                            : "text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 active:scale-95"
                    )}
                >
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                </button>

                <div className="flex flex-col items-center">
                    <span className="text-xs font-bold text-foreground">
                        Item {currentIndex} — <span className="text-muted-foreground font-normal">{page + 1} of {totalPages}</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                        {currentErrors > 0 && <span className="text-red-400">{currentErrors} error{currentErrors > 1 ? "s" : ""}</span>}
                        {currentErrors > 0 && (currentWarnings > 0 || currentInfos > 0) && <span>·</span>}
                        {currentWarnings > 0 && <span className="text-amber-400">{currentWarnings} warning{currentWarnings > 1 ? "s" : ""}</span>}
                        {currentWarnings > 0 && currentInfos > 0 && <span>·</span>}
                        {currentInfos > 0 && <span className="text-blue-400">{currentInfos} info</span>}
                    </span>
                </div>

                <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                    className={cn(
                        "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all",
                        page === totalPages - 1
                            ? "text-muted-foreground/30 cursor-not-allowed"
                            : "text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 active:scale-95"
                    )}
                >
                    Next
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Issues for the current item */}
            <div className="space-y-2">
                {currentIssues.map((issue, i) => {
                    const id = issue.issueId || `${issue.module}-${issue.message.slice(0, 30)}`
                    return (
                        <IssueCard
                            key={issue.issueId || `${currentIndex}-${i}`}
                            issue={issue}
                            feedback={feedbackMap[id]}
                            onAction={onAction}
                        />
                    )
                })}
            </div>

            {/* Page dots for quick visual reference */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 pt-1">
                    {sortedIndices.map((idx, i) => {
                        const pageIssues = grouped.get(idx) || []
                        const hasError = pageIssues.some(iss => iss.severity === "error")
                        return (
                            <button
                                key={idx}
                                onClick={() => setPage(i)}
                                className={cn(
                                    "w-2 h-2 rounded-full transition-all",
                                    i === page
                                        ? hasError ? "bg-red-400 scale-125" : "bg-emerald-400 scale-125"
                                        : hasError ? "bg-red-400/40 hover:bg-red-400/70" : "bg-muted-foreground/30 hover:bg-muted-foreground/60"
                                )}
                                title={`Item ${idx}`}
                            />
                        )
                    })}
                </div>
            )}
        </div>
    )
}
