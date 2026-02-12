"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { Loader2, History, CheckCircle2, AlertTriangle, Eye, Trash2 } from "lucide-react"

interface EvaluationHistoryTableProps {
    history: ValidationRecord[]
    isLoading: boolean
    onSelectRecord: (record: ValidationRecord) => void
    onDeleteRecord: (id: string, e: React.MouseEvent) => void
}

export function EvaluationHistoryTable({
    history,
    isLoading,
    onSelectRecord,
    onDeleteRecord
}: EvaluationHistoryTableProps) {

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleString()
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" /> Evaluation History
                </CardTitle>
                <CardDescription>
                    A log of all validation evaluations.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No evaluation history found.
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
                                            <Button variant="ghost" size="sm" onClick={() => onSelectRecord(record)}>
                                                <Eye className="mr-2 h-4 w-4" /> View Details
                                            </Button>
                                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => onDeleteRecord(record.id, e)}>
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
    )
}
