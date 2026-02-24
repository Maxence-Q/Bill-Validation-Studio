import { useState } from "react"
import { ValidationStep } from "@/components/validation/validation-progress"
import { Configuration } from "@/types/configuration"
import { PerturbationEngine } from "@/lib/validation/perturbation-engine"
import { EvaluationIssue } from "@/components/evaluation/evaluation-issues-display"
import { EvaluationMetrics, EvaluationPhase, EvaluationState } from "./types"

export function useEvaluationState(): EvaluationState {
    const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
    const [configs, setConfigs] = useState<Configuration[]>([])
    const [selectedConfig, setSelectedConfig] = useState<Configuration | null>(null)
    const [currentPhase, setCurrentPhase] = useState<EvaluationPhase>('initializing')
    const [evaluationIssues, setEvaluationIssues] = useState<EvaluationIssue[]>([])
    const [evaluationMetrics, setEvaluationMetrics] = useState<EvaluationMetrics | null>(null)
    const [evaluationReasonings, setEvaluationReasonings] = useState<Record<string, string[]> | null>(null)
    const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)
    const [lastSavedId, setLastSavedId] = useState<string | null>(null)
    const [perturbationEngine, setPerturbationEngine] = useState<PerturbationEngine | null>(null)
    const [retrievedPrompts, setRetrievedPrompts] = useState<any>(null)
    const [perturbationConfig, setPerturbationConfig] = useState<any>(null)
    const [systemMessage, setSystemMessage] = useState<string>("")
    const [userPromptTemplate, setUserPromptTemplate] = useState<string>("")

    return {
        validationSteps,
        setValidationSteps,
        configs,
        setConfigs,
        selectedConfig,
        setSelectedConfig,
        currentPhase,
        setCurrentPhase,
        evaluationIssues,
        setEvaluationIssues,
        evaluationMetrics,
        setEvaluationMetrics,
        evaluationReasonings,
        setEvaluationReasonings,
        isConfigDialogOpen,
        setIsConfigDialogOpen,
        lastSavedId,
        setLastSavedId,
        perturbationEngine,
        setPerturbationEngine,
        retrievedPrompts,
        setRetrievedPrompts,
        perturbationConfig,
        setPerturbationConfig,
        systemMessage,
        setSystemMessage,
        userPromptTemplate,
        setUserPromptTemplate,
    }
}
