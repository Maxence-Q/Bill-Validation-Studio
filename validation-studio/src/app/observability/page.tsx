"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, History, CheckCircle2, AlertTriangle, Eye, Loader2, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { ObservabilityDetailsDialog } from "@/components/observability/observability-details-dialog"
import { cn } from "@/lib/utils"
import { renderPrompt, parsePromptFile } from "@/lib/validation/prompt-builder"

export default function ObservabilityPage() {
    const [history, setHistory] = useState<ValidationRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedRecord, setSelectedRecord] = useState<ValidationRecord | null>(null)
    const [userPromptTemplate, setUserPromptTemplate] = useState<string>("")

    useEffect(() => {
        fetchHistory()

        // Fetch Prompts
        fetch("/api/tools/prompts?lang=en")
            .then(res => res.json())
            .then(data => {
                if (data.content) {
                    const parsed = parsePromptFile(data.content);
                    setUserPromptTemplate(parsed.userPromptTemplate);
                }
            })
            .catch(err => console.error("Failed to load prompts:", err));
    }, [])

    useEffect(() => {
        if (selectedRecord) {
            // Reset logic if needed, but component handles it
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
        // Moved to component
        return []
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
                                                <div className="flex items-center">
                                                    <AlertTriangle className={cn("mr-2 h-4 w-4", (record.issuesCount || 0) > 0 ? "text-destructive" : "text-muted-foreground")} />
                                                    {(record.issuesCount || 0)} Issues
                                                </div>
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

            <ObservabilityDetailsDialog
                record={selectedRecord}
                isOpen={!!selectedRecord}
                onClose={() => setSelectedRecord(null)}
                template={userPromptTemplate}
            />
        </div>
    )
}
