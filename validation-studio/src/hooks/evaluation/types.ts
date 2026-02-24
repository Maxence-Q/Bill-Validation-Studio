import { ValidationStep } from "@/components/validation/validation-progress"
import { Configuration } from "@/types/configuration"
import { PerturbationEngine } from "@/lib/validation/perturbation-engine"
import { EvaluationIssue } from "@/components/evaluation/evaluation-issues-display"

export type EvaluationPhase = 'initializing' | 'configuration' | 'perturbation_strategy' | 'ready' | 'running' | 'complete'

export interface EvaluationMetrics {
    precision: number
    recall: number
    tp: number
    fp: number
    fn: number
    moduleMetrics?: Record<string, any>
}

export interface EvaluationState {
    validationSteps: ValidationStep[]
    setValidationSteps: React.Dispatch<React.SetStateAction<ValidationStep[]>>
    configs: Configuration[]
    setConfigs: React.Dispatch<React.SetStateAction<Configuration[]>>
    selectedConfig: Configuration | null
    setSelectedConfig: React.Dispatch<React.SetStateAction<Configuration | null>>
    currentPhase: EvaluationPhase
    setCurrentPhase: React.Dispatch<React.SetStateAction<EvaluationPhase>>
    evaluationIssues: EvaluationIssue[]
    setEvaluationIssues: React.Dispatch<React.SetStateAction<EvaluationIssue[]>>
    evaluationMetrics: EvaluationMetrics | null
    setEvaluationMetrics: React.Dispatch<React.SetStateAction<EvaluationMetrics | null>>
    evaluationReasonings: Record<string, string[]> | null
    setEvaluationReasonings: React.Dispatch<React.SetStateAction<Record<string, string[]> | null>>
    isConfigDialogOpen: boolean
    setIsConfigDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
    lastSavedId: string | null
    setLastSavedId: React.Dispatch<React.SetStateAction<string | null>>
    perturbationEngine: PerturbationEngine | null
    setPerturbationEngine: React.Dispatch<React.SetStateAction<PerturbationEngine | null>>
    retrievedPrompts: any
    setRetrievedPrompts: React.Dispatch<React.SetStateAction<any>>
    perturbationConfig: any
    setPerturbationConfig: React.Dispatch<React.SetStateAction<any>>
    systemMessage: string
    setSystemMessage: React.Dispatch<React.SetStateAction<string>>
    userPromptTemplate: string
    setUserPromptTemplate: React.Dispatch<React.SetStateAction<string>>
}
