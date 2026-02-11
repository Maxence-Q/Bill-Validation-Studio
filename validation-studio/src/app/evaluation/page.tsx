"use client"
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { Loader2, Plus, ArrowRight, History, CheckCircle2, AlertTriangle, Eye, Trash2, FileJson, Upload } from "lucide-react"
import { Configuration } from "@/types/configuration"
import { CookieManager } from "@/lib/configuration/cookie-manager"
import { ConfigForm } from "@/components/configuration/config-form"
import { DialogHeader, DialogDescription } from "@/components/ui/dialog"

import { EvaluationModal } from "@/components/evaluation/evaluation-modal"
import { useEvaluationRunner } from "@/hooks/useEvaluationRunner"

export default function EvaluationPage() {
    const [history, setHistory] = useState<ValidationRecord[]>([])
    const [observabilityHistory, setObservabilityHistory] = useState<ValidationRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
    const [uploadedFile, setUploadedFile] = useState<File | null>(null)
    const [currentStep, setCurrentStep] = useState<'selection' | 'analysis'>('selection')

    const runner = useEvaluationRunner(selectedRunId, observabilityHistory)

    // Load configs when entering analysis mode
    useEffect(() => {
        if (currentStep === 'analysis') {
            runner.loadConfigs();
            runner.initializeAnalysisSteps();
        }
    }, [currentStep])

    useEffect(() => {
        fetchData()
    }, [])

    const resetModal = () => {
        setSelectedRunId(null)
        setUploadedFile(null)
        setCurrentStep('selection')
        runner.reset()
        setIsModalOpen(false)
    }

    const fetchData = async () => {
        try {
            const [evalRes, obsRes] = await Promise.all([
                fetch("/api/evaluation"),
                fetch("/api/observability")
            ])

            if (evalRes.ok) {
                const data = await evalRes.json()
                setHistory(data)
            }
            if (obsRes.ok) {
                const data = await obsRes.json()
                setObservabilityHistory(data)
            }
        } catch (error) {
            console.error("Failed to fetch history:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleString()
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploadedFile(e.target.files[0])
            setSelectedRunId(null)
        }
    }

    const handleRunSelection = (id: string) => {
        setSelectedRunId(id)
        setUploadedFile(null)
    }

    const handleForward = () => {
        if (selectedRunId || uploadedFile) {
            setCurrentStep('analysis')
        }
    }

    return (
        <main className="container py-8 max-w-[1600px]">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">Evaluation</h1>
                    <p className="text-xl text-muted-foreground">
                        Test event validation scenarios.
                    </p>
                </div>
                <Button onClick={() => setIsModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Create New Evaluation
                </Button>
            </div>

            <div className="grid gap-6">
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
                                                <Button variant="ghost" size="sm">
                                                    <Eye className="mr-2 h-4 w-4" /> View Details
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isModalOpen} onOpenChange={(open) => !open && resetModal()}>
                <DialogContent showCloseButton={false} className="max-w-[95vw] sm:max-w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden gap-0">
                    <div className="p-4 border-b flex justify-between items-center shrink-0">
                        <DialogTitle className="text-xl font-bold">New Evaluation</DialogTitle>
                        <Button variant="ghost" onClick={resetModal}>Close</Button>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        {currentStep === 'selection' ? (
                            <>
                                {/* Panel 1: Select Run */}
                                <div className="w-1/2 border-r flex flex-col">
                                    <div className="p-4 border-b bg-muted/10 font-medium text-sm text-muted-foreground flex justify-between items-center">
                                        <span>Select a Previous Run</span>
                                        {selectedRunId && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                    </div>
                                    <div className="flex-1 overflow-auto p-2 space-y-2">
                                        {observabilityHistory.map(record => (
                                            <div
                                                key={record.id}
                                                className={`p-3 rounded border cursor-pointer transition-colors ${selectedRunId === record.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted'}`}
                                                onClick={() => handleRunSelection(record.id)}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="font-medium">{record.eventName}</div>
                                                        <div className="text-xs text-muted-foreground">ID: {record.eventId}</div>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">{new Date(record.timestamp).toLocaleDateString()}</div>
                                                </div>
                                                <div className="mt-2 text-xs flex gap-2">
                                                    <span className={record.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                                                        {record.status.toUpperCase()}
                                                    </span>
                                                    <span>{record.issuesCount} Issues</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Panel 2: Upload */}
                                <div className="w-1/2 flex flex-col">
                                    <div className="p-4 border-b bg-muted/10 font-medium text-sm text-muted-foreground flex justify-between items-center">
                                        <span>Upload New Event JSON</span>
                                        {uploadedFile && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                    </div>
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-12 w-full max-w-md flex flex-col items-center gap-4 hover:bg-muted/5 transition-colors">
                                            <div className="bg-muted p-4 rounded-full">
                                                <Upload className="h-8 w-8 text-muted-foreground" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-lg">Upload JSON File</h3>
                                                <p className="text-sm text-muted-foreground mt-1">Drag and drop or click to select</p>
                                            </div>
                                            <input
                                                type="file"
                                                accept=".json"
                                                onChange={handleFileUpload}
                                                className="hidden"
                                                id="file-upload"
                                            />
                                            <Button variant="outline" asChild>
                                                <label htmlFor="file-upload" className="cursor-pointer">
                                                    Select File
                                                </label>
                                            </Button>
                                            {uploadedFile && (
                                                <div className="flex items-center gap-2 mt-4 p-2 bg-muted/50 rounded text-sm w-full justify-center">
                                                    <FileJson className="h-4 w-4" />
                                                    <span className="truncate max-w-[200px]">{uploadedFile.name}</span>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={(e) => {
                                                        e.preventDefault();
                                                        setUploadedFile(null);
                                                    }}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <EvaluationModal
                                validationSteps={runner.validationSteps}
                                configs={runner.configs}
                                selectedConfig={runner.selectedConfig}
                                currentPhase={runner.currentPhase}
                                evaluationIssues={runner.evaluationIssues}
                                evaluationMetrics={runner.evaluationMetrics}
                                getLoadingText={runner.getLoadingText}
                                onConfigSelect={runner.handleConfigSelect}
                                onNewConfig={() => runner.setIsConfigDialogOpen(true)}
                                onStrategyConfirm={runner.handleStrategyConfirm}
                                onRunEvaluation={runner.runEvaluation}
                                onFinish={resetModal}
                            />
                        )}
                    </div>

                    {/* Footer with Forward Button (Only in Selection Mode) */}
                    {currentStep === 'selection' && (
                        <div className="p-4 border-t bg-muted/30 flex justify-end shrink-0">
                            <Button
                                onClick={handleForward}
                                disabled={(!selectedRunId && !uploadedFile)}
                                className="w-32"
                            >
                                Forward <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <Dialog open={runner.isConfigDialogOpen} onOpenChange={runner.setIsConfigDialogOpen}>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                                <DialogTitle>New Configuration</DialogTitle>
                                <DialogDescription>
                                    Configure the model, temperature, and other validation parameters.
                                </DialogDescription>
                            </DialogHeader>
                            <ConfigForm
                                initialData={null}
                                onSubmit={(newConfig) => runner.handleNewConfig(newConfig)}
                                onCancel={() => runner.setIsConfigDialogOpen(false)}
                            />
                        </DialogContent>
                    </Dialog>
                </DialogContent>
            </Dialog>
        </main>
    );
}
