"use client"

import { useState, useMemo } from "react"
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Info, AlertTriangle, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export interface ValidationIssue {
    path: string
    severity: "error" | "warning" | "info"
    message: string
    suggestion?: string
    module?: string
}

interface HomeIssuesDisplayProps {
    issues: ValidationIssue[]
}

export function HomeIssuesDisplay({ issues }: HomeIssuesDisplayProps) {
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

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case "error": return <AlertCircle className="h-5 w-5 text-red-500" />
            case "warning": return <AlertTriangle className="h-5 w-5 text-amber-500" />
            case "info": return <Info className="h-5 w-5 text-blue-500" />
            default: return <CheckCircle2 className="h-5 w-5 text-green-500" />
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
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                    View Detailed Results ({issues.length})
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[70vw] h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Validation Detailed Results</DialogTitle>
                    <DialogDescription>
                        Review all issues found during the validation process.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex flex-col gap-4 overflow-hidden pt-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/30 p-4 rounded-lg border shrink-0">
                        <div>
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                Issues Found
                                <Badge variant="secondary" className="text-sm">
                                    {filteredIssues.length} / {issues.length}
                                </Badge>
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Filter by module or severity to focus on specific problems.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {/* Module Filter */}
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-muted-foreground" />
                                <select
                                    className="h-9 w-[150px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    value={selectedModule}
                                    onChange={(e) => setSelectedModule(e.target.value)}
                                >
                                    {uniqueModules.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Severity Filter */}
                            <div className="flex border rounded-md overflow-hidden">
                                {(["All", "error", "warning", "info"] as const).map((sev) => (
                                    <button
                                        key={sev}
                                        onClick={() => setSelectedSeverity(sev)}
                                        className={cn(
                                            "px-3 py-1 text-sm font-medium transition-colors hover:bg-muted",
                                            selectedSeverity === sev
                                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                                : "bg-background text-foreground"
                                        )}
                                    >
                                        {sev === "All" ? "All" : sev.charAt(0).toUpperCase() + sev.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <ScrollArea className="flex-1 pr-4">
                        <div className="space-y-3 pb-4">
                            {filteredIssues.length === 0 ? (
                                <div className="text-center text-muted-foreground py-12 border-2 border-dashed rounded-lg">
                                    No issues found matching the selected filters.
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
                                                        "text-[10px] uppercase font-bold opacity-80 px-2 py-0.5 rounded border border-current",
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
                                                        <div className="flex gap-2 text-xs text-muted-foreground mt-2">
                                                            <span className="bg-white/50 border border-black/5 px-2 py-1 rounded shadow-sm">
                                                                Module: <span className="font-medium text-foreground">{issue.module || "Unknown"}</span>
                                                            </span>
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
            </DialogContent>
        </Dialog>
    )
}
