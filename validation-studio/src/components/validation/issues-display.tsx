"use client"

import { useState, useEffect, useRef } from "react"
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
    classification?: 'TP' | 'FP'
}

interface IssuesDisplayProps {
    issues: ValidationIssue[]
    highlightedPath?: string | null
}

export function IssuesDisplay({ issues, highlightedPath }: IssuesDisplayProps) {
    const [expandedIssues, setExpandedIssues] = useState<string[]>([])
    const lastAutoExpandedRef = useRef<string | null>(null)

    // Scroll to highlighted issue
    useEffect(() => {
        if (highlightedPath) {
            // Find index of issue with matching path
            const index = issues.findIndex(i => i.path === highlightedPath)
            if (index !== -1) {
                const id = index.toString()

                setExpandedIssues(prev => {
                    let newPrev = prev
                    // Close the previously auto-expanded issue if it's different
                    if (lastAutoExpandedRef.current && lastAutoExpandedRef.current !== id) {
                        newPrev = newPrev.filter(i => i !== lastAutoExpandedRef.current)
                    }
                    // Open the new one
                    if (!newPrev.includes(id)) {
                        return [...newPrev, id]
                    }
                    return newPrev
                })

                lastAutoExpandedRef.current = id

                // Scroll to it
                const element = document.getElementById(`issue-${index}`)
                if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "center" })
                }
            }
        } else {
            // If highlightedPath is null, close the last auto-expanded issue
            if (lastAutoExpandedRef.current) {
                setExpandedIssues(prev => prev.filter(i => i !== lastAutoExpandedRef.current))
                lastAutoExpandedRef.current = null
            }
        }
    }, [highlightedPath, issues])

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
                issues.map((issue, idx) => {
                    const isHighlighted = highlightedPath && issue.path === highlightedPath
                    return (
                        <div
                            key={idx}
                            id={`issue-${idx}`}
                            className={cn(
                                "border rounded-lg p-3 transition-all cursor-pointer",
                                getSeverityColor(issue.severity),
                                isHighlighted && "ring-2 ring-primary ring-offset-2 scale-[1.02] shadow-md"
                            )}
                            onClick={() => toggleIssue(idx)}
                        >
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">{getSeverityIcon(issue.severity)}</div>
                                <div className="flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <h4 className="font-semibold text-sm font-mono break-all">{issue.path}</h4>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {issue.classification && (
                                                <div className={cn(
                                                    "flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0 border",
                                                    issue.classification === 'TP'
                                                        ? "bg-green-100 text-green-700 border-green-300"
                                                        : "bg-red-100 text-red-700 border-red-300"
                                                )}>
                                                    {issue.classification}
                                                </div>
                                            )}
                                            <span className="text-xs uppercase font-bold opacity-60 px-2 py-0.5 rounded bg-white/50">
                                                {issue.severity}
                                            </span>
                                        </div>
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
                    )
                })
            )}
        </div>
    )
}
