"use client"

import { useState, useMemo } from "react"
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Info, AlertTriangle, Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface EvaluationIssue {
    path: string
    severity: "error" | "warning" | "info"
    message: string
    suggestion?: string
    module?: string
    itemIndex?: number
}

interface EvaluationMetrics {
    precision: number
    recall: number
    tp: number
    fp: number
    fn: number
}

interface EvaluationIssuesDisplayProps {
    issues: EvaluationIssue[]
    metrics?: EvaluationMetrics | null
}

export function EvaluationIssuesDisplay({ issues, metrics }: EvaluationIssuesDisplayProps) {
    const [expandedIssues, setExpandedIssues] = useState<string[]>([])
    const [selectedModule, setSelectedModule] = useState<string>("All")
    const [selectedSeverity, setSelectedSeverity] = useState<string>("All")

    const toggleIssue = (index: number) => {
        const id = index.toString()
        setExpandedIssues(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

    const uniqueModules = useMemo(() => {
        const modules = issues.map(i => i.module || "Unknown")
        return ["All", ...Array.from(new Set(modules))]
    }, [issues])

    const filteredIssues = useMemo(() => {
        return issues.filter(issue => {
            const moduleMatch = selectedModule === "All" || (issue.module || "Unknown") === selectedModule
            const severityMatch = selectedSeverity === "All" || issue.severity === selectedSeverity
            return moduleMatch && severityMatch
        })
    }, [issues, selectedModule, selectedSeverity])

    const errorCount = issues.filter(i => i.severity === "error").length
    const warningCount = issues.filter(i => i.severity === "warning").length
    const infoCount = issues.filter(i => i.severity === "info").length

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case "error": return <AlertCircle className="h-4 w-4 text-red-500" />
            case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500" />
            case "info": return <Info className="h-4 w-4 text-blue-500" />
            default: return <CheckCircle2 className="h-4 w-4 text-green-500" />
        }
    }

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "error": return "border-red-200 bg-red-50 text-slate-900"
            case "warning": return "border-amber-200 bg-amber-50 text-slate-900"
            case "info": return "border-blue-200 bg-blue-50 text-slate-900"
            default: return "border-gray-200 bg-gray-50 text-slate-900"
        }
    }

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Summary Header */}
            <div className="bg-muted/30 p-4 rounded-lg border shrink-0">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
                    Evaluation Results
                    <Badge variant="secondary" className="text-sm">
                        {issues.length} issues
                    </Badge>
                </h3>

                {/* Severity summary pills */}
                <div className="flex gap-3 mb-3">
                    {errorCount > 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded-full border border-red-200">
                            <AlertCircle className="h-3 w-3" /> {errorCount} errors
                        </span>
                    )}
                    {warningCount > 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full border border-amber-200">
                            <AlertTriangle className="h-3 w-3" /> {warningCount} warnings
                        </span>
                    )}
                    {infoCount > 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded-full border border-blue-200">
                            <Info className="h-3 w-3" /> {infoCount} info
                        </span>
                    )}
                    {issues.length === 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full border border-green-200">
                            <CheckCircle2 className="h-3 w-3" /> No issues detected
                        </span>
                    )}
                </div>

                {/* Precision / Recall pills */}
                {metrics && (
                    <div className="flex gap-3 mb-3">
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full border border-emerald-200">
                            Precision: {(metrics.precision * 100).toFixed(1)}%
                            <span className="text-emerald-500 ml-0.5">({metrics.tp} TP / {metrics.tp + metrics.fp} detected)</span>
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-violet-700 bg-violet-100 px-2 py-1 rounded-full border border-violet-200">
                            Recall: {(metrics.recall * 100).toFixed(1)}%
                            <span className="text-violet-500 ml-0.5">({metrics.tp} TP / {metrics.tp + metrics.fn} perturbations)</span>
                        </span>
                        {metrics.fp > 0 && (
                            <span className="flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded-full border border-orange-200">
                                {metrics.fp} hallucinations
                            </span>
                        )}
                    </div>
                )}

                {/* Filters */}
                <div className="flex flex-wrap gap-2 items-center">
                    <Filter className="h-4 w-4 text-muted-foreground" />

                    {/* Module Filter */}
                    <select
                        className="h-8 w-[140px] rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        value={selectedModule}
                        onChange={(e) => setSelectedModule(e.target.value)}
                    >
                        {uniqueModules.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>

                    {/* Severity Filter */}
                    <div className="flex border rounded-md overflow-hidden">
                        {(["All", "error", "warning", "info"] as const).map((sev) => (
                            <button
                                key={sev}
                                onClick={() => setSelectedSeverity(sev)}
                                className={cn(
                                    "px-2 py-1 text-xs font-medium transition-colors hover:bg-muted",
                                    selectedSeverity === sev
                                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                        : "bg-background text-foreground"
                                )}
                            >
                                {sev === "All" ? "All" : sev.charAt(0).toUpperCase() + sev.slice(1)}
                            </button>
                        ))}
                    </div>

                    <span className="text-xs text-muted-foreground ml-auto">
                        {filteredIssues.length} / {issues.length}
                    </span>
                </div>
            </div>

            {/* Issues List */}
            <ScrollArea className="flex-1 pr-2">
                <div className="space-y-2 pb-4">
                    {filteredIssues.length === 0 ? (
                        <div className="text-center text-muted-foreground py-12 border-2 border-dashed rounded-lg">
                            {issues.length === 0
                                ? "The LLM found no issues with the perturbed prompts."
                                : "No issues match the selected filters."
                            }
                        </div>
                    ) : (
                        filteredIssues.map((issue, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "border rounded-lg p-3 transition-all cursor-pointer hover:shadow-sm",
                                    getSeverityColor(issue.severity)
                                )}
                                onClick={() => toggleIssue(idx)}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5 shrink-0">{getSeverityIcon(issue.severity)}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="font-semibold text-sm font-mono truncate" title={issue.path}>
                                                {issue.path}
                                            </h4>
                                            <span className={cn(
                                                "text-[10px] uppercase font-bold opacity-80 px-2 py-0.5 rounded border border-current shrink-0",
                                                issue.severity === "error" ? "text-red-700 bg-red-100 border-red-200" :
                                                    issue.severity === "warning" ? "text-amber-700 bg-amber-100 border-amber-200" :
                                                        "text-blue-700 bg-blue-100 border-blue-200"
                                            )}>
                                                {issue.severity}
                                            </span>
                                        </div>
                                        <p className="text-sm mt-1 text-slate-700">{issue.message}</p>

                                        {expandedIssues.includes(idx.toString()) && (
                                            <div className="mt-3 pt-3 border-t border-black/5 text-sm animate-in slide-in-from-top-2 duration-200">
                                                {issue.suggestion && (
                                                    <div className="mb-2">
                                                        <span className="font-semibold block mb-1 text-slate-800">Suggestion:</span>
                                                        <div className="bg-white/60 p-2 rounded border border-black/5 text-slate-700">
                                                            {issue.suggestion}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex gap-2 text-xs mt-2">
                                                    <span className="bg-slate-200 text-slate-600 border border-slate-300 px-2 py-1 rounded shadow-sm">
                                                        Module: <span className="font-medium text-slate-800">{issue.module || "Unknown"}</span>
                                                    </span>
                                                    {issue.itemIndex !== undefined && (
                                                        <span className="bg-slate-200 text-slate-600 border border-slate-300 px-2 py-1 rounded shadow-sm">
                                                            Prompt: <span className="font-medium text-slate-800">#{issue.itemIndex + 1}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-muted-foreground shrink-0">
                                        {expandedIssues.includes(idx.toString()) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
