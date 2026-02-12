"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ArrowRight, Upload, FileJson, Trash2 } from "lucide-react"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { EvaluationModal } from "@/components/evaluation/evaluation-modal"
import { ConfigForm } from "@/components/configuration/config-form"
import { useEvaluationRunner } from "@/hooks/useEvaluationRunner"

interface CreateEvaluationDialogProps {
    isOpen: boolean
    onClose: () => void
    observabilityHistory: ValidationRecord[]
}

export function CreateEvaluationDialog({
    isOpen,
    onClose,
    observabilityHistory
}: CreateEvaluationDialogProps) {
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

    // Reset when dialog opens/closes
    useEffect(() => {
        if (!isOpen) {
            // Reset local state when dialog closes
            setTimeout(() => {
                setSelectedRunId(null)
                setUploadedFile(null)
                setCurrentStep('selection')
                runner.reset()
            }, 300) // Small delay to avoid visual flickering during close animation
        }
    }, [isOpen])

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

    const handleClose = () => {
        onClose()
    }

    const handleFinish = () => {
        onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent showCloseButton={false} className="max-w-[95vw] sm:max-w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden gap-0">
                <div className="p-4 border-b flex justify-between items-center shrink-0">
                    <DialogTitle className="text-xl font-bold">New Evaluation</DialogTitle>
                    <Button variant="ghost" onClick={handleClose}>Close</Button>
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
                            onFinish={handleFinish}
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
    )
}
