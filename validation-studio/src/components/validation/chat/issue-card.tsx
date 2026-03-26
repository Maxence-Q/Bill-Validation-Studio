import { AlertCircle, AlertTriangle, Info, CheckCircle2, Check, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { IssueCardProps } from "./types"

function SeverityIcon({ severity }: { severity: string }) {
    switch (severity) {
        case "error":
            return <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        case "warning":
            return <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        case "info":
            return <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        default:
            return null
    }
}

export function IssueCard({ issue, feedback, onAction }: IssueCardProps) {
    const issueId = issue.issueId || `${issue.module}-${issue.message.slice(0, 30)}`

    // Dismissed issues are hidden by the parent — but if somehow rendered, show nothing
    if (feedback === 'dismissed') return null

    const isFixed = feedback === 'fixed'

    return (
        <div
            className={cn(
                "rounded-lg p-3 text-sm border transition-all duration-300",
                isFixed
                    ? "bg-emerald-500/5 border-emerald-500/20 opacity-60"
                    : cn(
                        "space-y-1",
                        issue.severity === "error" && "bg-red-500/5 border-red-500/20",
                        issue.severity === "warning" && "bg-amber-500/5 border-amber-500/20",
                        issue.severity === "info" && "bg-blue-500/5 border-blue-500/20"
                    )
            )}
        >
            <div className="flex items-start gap-2">
                {isFixed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                    <SeverityIcon severity={issue.severity} />
                )}
                <span className={cn(
                    "text-foreground font-medium leading-snug flex-1",
                    isFixed && "line-through text-muted-foreground"
                )}>
                    {issue.message}
                </span>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {!isFixed && (
                        <button
                            onClick={() => onAction(issueId, 'fixed')}
                            title="Mark as fixed on billing platform"
                            className={cn(
                                "p-2 rounded-lg transition-all shadow-sm",
                                "bg-emerald-500/10 text-emerald-400/70 hover:text-emerald-300 hover:bg-emerald-500/20 hover:scale-105 active:scale-95",
                                "border border-emerald-500/20"
                            )}
                        >
                            <Check className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={() => onAction(issueId, 'dismissed')}
                        title="Dismiss — not relevant"
                        className={cn(
                            "p-2 rounded-lg transition-all shadow-sm",
                            "bg-red-500/10 text-red-500/70 hover:text-red-400 hover:bg-red-500/20 hover:scale-105 active:scale-95",
                            "border border-red-500/20"
                        )}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
            {!isFixed && issue.suggestion && (
                <p className="text-muted-foreground text-xs ml-6 leading-relaxed">
                    💡 {issue.suggestion}
                </p>
            )}
        </div>
    )
}
