"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Configuration } from "@/types/configuration"
import { ValidationStep, ValidationProgress } from "@/components/validation/validation-progress"
import { PerturbationStrategyConfig } from "@/components/evaluation/perturbation-strategy-config"
import { EvaluationIssuesDisplay, EvaluationIssue } from "@/components/evaluation/evaluation-issues-display"
import { ConfigSelector } from "@/components/evaluation/config-selector"
import { ReadyToLaunch } from "@/components/evaluation/ready-to-launch"
import { EvaluationPhase, EvaluationMetrics } from "@/hooks/useEvaluationRunner"

interface EvaluationModalProps {
    validationSteps: ValidationStep[]
    configs: Configuration[]
    selectedConfig: Configuration | null
    currentPhase: EvaluationPhase
    evaluationIssues: EvaluationIssue[]
    evaluationMetrics: EvaluationMetrics | null
    getLoadingText: () => string
    onConfigSelect: (config: Configuration) => void
    onNewConfig: () => void
    onStrategyConfirm: (config: any) => void
    onRunEvaluation: () => void
    onFinish: () => void
}

export function EvaluationModal({
    validationSteps,
    configs,
    selectedConfig,
    currentPhase,
    evaluationIssues,
    evaluationMetrics,
    getLoadingText,
    onConfigSelect,
    onNewConfig,
    onStrategyConfirm,
    onRunEvaluation,
    onFinish,
}: EvaluationModalProps) {
    return (
        <>
            {/* Left Panel: Progress */}
            <div className="w-[35%] border-r flex flex-col bg-muted/5">
                <div className="p-4 border-b bg-muted/10 font-medium text-sm text-muted-foreground">
                    Analysis Progress
                </div>
                <div className="flex-1 overflow-auto p-6">
                    <ValidationProgress steps={validationSteps.map(s => ({ ...s, subSteps: undefined }))} />
                </div>
            </div>

            {/* Right Panel: Configuration & Action */}
            <div className="w-[65%] flex flex-col bg-background relative">
                <div className="p-4 border-b bg-muted/10 font-medium text-sm text-muted-foreground flex justify-between items-center">
                    <span>Configuration & Execution</span>
                    {selectedConfig && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                            {selectedConfig.name}
                        </span>
                    )}
                </div>

                <div className="flex-1 overflow-auto p-6">
                    {currentPhase === 'configuration' ? (
                        <ConfigSelector
                            configs={configs}
                            selectedConfig={selectedConfig}
                            onSelect={onConfigSelect}
                            onNewConfig={onNewConfig}
                        />
                    ) : currentPhase === 'perturbation_strategy' ? (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <PerturbationStrategyConfig onConfirm={onStrategyConfirm} />
                        </div>
                    ) : currentPhase === 'complete' ? (
                        <div className="h-full flex flex-col animate-in fade-in duration-300">
                            <EvaluationIssuesDisplay issues={evaluationIssues} metrics={evaluationMetrics} />
                        </div>
                    ) : currentPhase === 'running' && validationSteps.find(s => s.id === 'llm_call')?.status === 'loading' ? (
                        <div className="h-full flex flex-col animate-in fade-in duration-300 p-2">
                            <h3 className="text-sm font-semibold text-muted-foreground mb-4">LLM Processing Progress</h3>
                            <ValidationProgress steps={validationSteps.find(s => s.id === 'llm_call')?.subSteps || []} />
                        </div>
                    ) : currentPhase === 'ready' ? (
                        <ReadyToLaunch />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
                            <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
                            <p className="text-lg font-medium">{getLoadingText()}</p>
                        </div>
                    )}
                </div>

                {/* Action Footer */}
                <div className="p-4 border-t bg-muted/5 flex justify-end">
                    {currentPhase === 'complete' ? (
                        <Button
                            size="lg"
                            onClick={onFinish}
                            className="w-40"
                        >
                            Finish
                        </Button>
                    ) : (
                        <Button
                            size="lg"
                            onClick={onRunEvaluation}
                            disabled={currentPhase !== 'ready'}
                            className="w-40"
                        >
                            {currentPhase === 'running' ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running</>
                            ) : (
                                "Run Evaluation"
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </>
    )
}
