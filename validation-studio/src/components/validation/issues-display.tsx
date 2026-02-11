"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ValidationIssue {
    path: string
    severity: "error" | "warning" | "info"
    message: string
    suggestion?: string
    module?: string
}

interface IssuesDisplayProps {
    issues: ValidationIssue[]
}

export function IssuesDisplay({ issues }: IssuesDisplayProps) {
    const [expandedIssues, setExpandedIssues] = useState<string[]>([])

    const toggleIssue = (index: number) => {
        const id = index.toString()
        setExpandedIssues(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        )
    }

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
        <div className="space-y-3">
            {issues.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                    No issues found for this specific prompt.
                </div>
            ) : (
                issues.map((issue, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "border rounded-lg p-3 transition-all cursor-pointer",
                            getSeverityColor(issue.severity)
                        )}
                        onClick={() => toggleIssue(idx)}
                    >
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5">{getSeverityIcon(issue.severity)}</div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-semibold text-sm font-mono">{issue.path}</h4>
                                    <span className="text-xs uppercase font-bold opacity-60 px-2 py-0.5 rounded bg-white/50">
                                        {issue.severity}
                                    </span>
                                </div>
                                <p className="text-sm mt-1">{issue.message}</p>

                                {expandedIssues.includes(idx.toString()) && (
                                    <div className="mt-3 pt-3 border-t border-black/10 text-sm">
                                        {issue.suggestion && (
                                            <div className="mb-2">
                                                <span className="font-semibold block mb-1">Suggestion:</span>
                                                <div className="bg-white/50 p-2 rounded">{issue.suggestion}</div>
                                            </div>
                                        )}
                                        <div className="flex gap-2 text-xs text-gray-500 mt-2">
                                            <span className="bg-gray-200 px-2 py-1 rounded">Module: {issue.module || "Unknown"}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="text-gray-400">
                                {expandedIssues.includes(idx.toString()) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}
