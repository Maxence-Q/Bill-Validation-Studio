"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, History, CheckCircle2, AlertTriangle, Eye, Loader2, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { IssuesDisplay } from "@/components/validation/issues-display"
import { cn } from "@/lib/utils"

export default function ObservabilityPage() {
    const [history, setHistory] = useState<ValidationRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedRecord, setSelectedRecord] = useState<ValidationRecord | null>(null)
    const [activeModule, setActiveModule] = useState<string>("Event")
    const [promptIndex, setPromptIndex] = useState(0)

    useEffect(() => {
        fetchHistory()
    }, [])

    useEffect(() => {
        if (selectedRecord) {
            setActiveModule("Event")
            setPromptIndex(0)
        }
    }, [selectedRecord])

    const fetchHistory = async () => {
        try {
            const res = await fetch("/api/observability")
            if (res.ok) {
                const data = await res.json()
                setHistory(data)
            }
        } catch (error) {
            console.error("Failed to fetch history:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const deleteRecord = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this validation record?")) return;

        try {
            const res = await fetch(`/api/observability?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                setHistory(prev => prev.filter(r => r.id !== id));
            } else {
                console.error("Failed to delete record");
            }
        } catch (error) {
            console.error("Error deleting record:", error);
        }
    }

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleString()
    }

    const getFilteredIssues = () => {
        if (!selectedRecord) return []
        return selectedRecord.issues.filter(issue =>
            (issue.module === activeModule) &&
            (issue.itemIndex === undefined || issue.itemIndex === promptIndex)
        )
    }

    const getCurrentPrompt = () => {
        if (!selectedRecord?.prompts) return "No Prompt Data"
        const modulePrompts = selectedRecord.prompts[activeModule]
        if (!modulePrompts) return "No prompt for this module"
        return Array.isArray(modulePrompts) ? modulePrompts[promptIndex] : JSON.stringify(modulePrompts, null, 2)
    }

    const getTotalPrompts = () => {
        if (!selectedRecord?.prompts) return 0
        const modulePrompts = selectedRecord.prompts[activeModule]
        return Array.isArray(modulePrompts) ? modulePrompts.length : 1
    }

    return (
        <div className="container py-8 max-w-[1600px]">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
                        Observability
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        Review past validation runs and their detailed results.
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Studio
                    </Link>
                </Button>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-5 w-5" /> Validation History
                        </CardTitle>
                        <CardDescription>
                            A log of all validation attempts performed in this environment.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No validation history found. Run a validation in the Studio to see results here.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Event Name</TableHead>
                                        <TableHead>Event ID</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Issues Found</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.map((record) => (
                                        <TableRow key={record.id}>
                                            <TableCell className="font-medium">{formatDate(record.timestamp)}</TableCell>
                                            <TableCell>{record.eventName}</TableCell>
                                            <TableCell>{record.eventId}</TableCell>
                                            <TableCell>
                                                {record.status === "success" ? (
                                                    <div className="flex items-center text-green-500">
                                                        <CheckCircle2 className="mr-1 h-4 w-4" /> Success
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center text-destructive">
                                                        <AlertTriangle className="mr-1 h-4 w-4" /> Failed
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {record.issuesCount > 0 ? (
                                                    <span className="text-amber-500 font-medium">{record.issuesCount} Issues</span>
                                                ) : (
                                                    <span className="text-green-500">No Issues</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => setSelectedRecord(record)}>
                                                        <Eye className="mr-2 h-4 w-4" /> View Details
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => deleteRecord(record.id, e)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
                <DialogContent showCloseButton={false} className="max-w-[95vw] sm:max-w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden gap-0">
                    {selectedRecord && (
                        <>
                            {/* Header */}
                            <div className="p-4 border-b flex justify-between items-center shrink-0">
                                <div>
                                    <DialogTitle className="text-xl font-bold">Validation Details</DialogTitle>
                                    <p className="text-muted-foreground text-sm">
                                        {selectedRecord.eventName} (ID: {selectedRecord.eventId}) - {formatDate(selectedRecord.timestamp)}
                                    </p>
                                </div>
                                <Button variant="ghost" onClick={() => setSelectedRecord(null)}>Close</Button>
                            </div>

                            {/* Controls */}
                            <div className="border-b bg-muted/30 p-2 flex flex-col gap-2 shrink-0">
                                {/* Module Selector */}
                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                    {selectedRecord.prompts && Object.keys(selectedRecord.prompts).map(module => (
                                        <Button
                                            key={module}
                                            variant={activeModule === module ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => { setActiveModule(module); setPromptIndex(0); }}
                                        >
                                            {module}
                                        </Button>
                                    ))}
                                </div>

                                {/* Pagination (if needed) */}
                                {getTotalPrompts() > 1 && (
                                    <div className="flex items-center justify-center gap-4 py-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={promptIndex === 0}
                                            onClick={() => setPromptIndex(prev => prev - 1)}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="text-sm font-medium">
                                            Prompt {promptIndex + 1} of {getTotalPrompts()}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={promptIndex >= getTotalPrompts() - 1}
                                            onClick={() => setPromptIndex(prev => prev + 1)}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Split View */}
                            <div className="flex-1 flex overflow-hidden">
                                {/* Left: Prompt */}
                                <div className="w-1/2 flex flex-col border-r">
                                    <div className="p-3 border-b bg-muted/10 font-medium text-sm text-muted-foreground">
                                        Prompt Content
                                    </div>
                                    <div className="flex-1 overflow-auto p-4 bg-muted/5 font-mono text-xs whitespace-pre-wrap">
                                        {getCurrentPrompt()}
                                    </div>
                                </div>

                                {/* Right: Issues */}
                                <div className="w-1/2 flex flex-col">
                                    <div className="p-3 border-b bg-muted/10 font-medium text-sm text-muted-foreground flex justify-between">
                                        <span>Issues Found</span>
                                        <span className={cn("text-xs px-2 py-0.5 rounded-full",
                                            getFilteredIssues().length > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                        )}>
                                            {getFilteredIssues().length} issues
                                        </span>
                                    </div>
                                    <div className="flex-1 overflow-auto p-4">
                                        <IssuesDisplay issues={getFilteredIssues()} />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
