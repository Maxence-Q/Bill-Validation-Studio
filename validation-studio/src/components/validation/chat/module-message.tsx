import { Bot, CheckCircle2 } from "lucide-react"
import { ListModuleIssues } from "./list-module-issues"
import { IssueCard } from "./issue-card"
import { ModuleMessageProps } from "./types"

const LIST_MODULES = ["Prices", "PriceGroups", "RightToSellAndFees"]

export function ModuleMessage({ entry, index, feedbackMap, onAction }: ModuleMessageProps) {
    // Filter out dismissed issues for counts
    const visibleIssues = entry.issues.filter(issue => {
        const id = issue.issueId || `${issue.module}-${issue.message.slice(0, 30)}`
        return feedbackMap[id] !== 'dismissed'
    })

    const hasIssues = visibleIssues.length > 0
    const isListModule = LIST_MODULES.includes(entry.module)
    const errorCount = visibleIssues.filter(i => i.severity === "error").length
    const warningCount = visibleIssues.filter(i => i.severity === "warning").length
    const infoCount = visibleIssues.filter(i => i.severity === "info").length

    // For list modules, count unique items
    const uniqueItems = isListModule && hasIssues
        ? new Set(visibleIssues.map(i => i.itemIndex ?? 0)).size
        : 0

    return (
        <div
            className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: `${index * 80}ms` }}
        >
            {/* Avatar */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Bot className="w-4 h-4 text-white" />
            </div>

            {/* Message Bubble */}
            <div className="flex-1 max-w-[85%]">
                <div className="bg-muted/60 backdrop-blur-sm rounded-2xl rounded-tl-sm p-4 border border-border/50 space-y-3">
                    {/* Header */}
                    <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-foreground">
                            {entry.module}
                        </span>
                        {hasIssues ? (
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                {errorCount > 0 && <span className="text-red-400">{errorCount} error{errorCount > 1 ? "s" : ""}</span>}
                                {errorCount > 0 && (warningCount > 0 || infoCount > 0) && <span>·</span>}
                                {warningCount > 0 && <span className="text-amber-400">{warningCount} warning{warningCount > 1 ? "s" : ""}</span>}
                                {warningCount > 0 && infoCount > 0 && <span>·</span>}
                                {infoCount > 0 && <span className="text-blue-400">{infoCount} info</span>}
                                {isListModule && uniqueItems > 0 && (
                                    <>
                                        <span>·</span>
                                        <span className="text-muted-foreground">{uniqueItems} item{uniqueItems > 1 ? "s" : ""}</span>
                                    </>
                                )}
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-xs text-emerald-400">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                No issues
                            </span>
                        )}
                    </div>

                    {/* Message body */}
                    {hasIssues ? (
                        <>
                            <p className="text-sm text-muted-foreground">
                                I have just finished validating the <strong className="text-foreground">{entry.module}</strong> module.
                                {isListModule
                                    ? <> I found issues across <strong className="text-foreground">{uniqueItems} item{uniqueItems > 1 ? "s" : ""}</strong>. Use the arrows below to navigate between items:</>
                                    : <> Here are the issues I have identified:</>
                                }
                            </p>

                            {isListModule ? (
                                <ListModuleIssues issues={entry.issues} feedbackMap={feedbackMap} onAction={onAction} />
                            ) : (
                                <div className="space-y-2">
                                    {entry.issues
                                        .filter(issue => {
                                            const id = issue.issueId || `${issue.module}-${issue.message.slice(0, 30)}`
                                            return feedbackMap[id] !== 'dismissed'
                                        })
                                        .map((issue, i) => {
                                            const id = issue.issueId || `${issue.module}-${issue.message.slice(0, 30)}`
                                            return (
                                                <IssueCard
                                                    key={issue.issueId || i}
                                                    issue={issue}
                                                    feedback={feedbackMap[id]}
                                                    onAction={onAction}
                                                />
                                            )
                                        })
                                    }
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            I have just finished validating the <strong className="text-foreground">{entry.module}</strong> module. Everything looks good — no issues were identified. ✅
                        </p>
                    )}
                </div>
                {/* Timestamp */}
                <span className="text-[10px] text-muted-foreground/50 ml-2 mt-1 block">
                    Module {index + 1} completed
                </span>
            </div>
        </div>
    )
}
