"use client"

import { useCallback } from "react"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { useEvaluationState } from "./evaluation/use-evaluation-state"
import { useEvaluationInitialization } from "./evaluation/use-evaluation-initialization"
import { useEvaluationHandlers } from "./evaluation/use-evaluation-handlers"
import { useEvaluationExecution } from "./evaluation/use-evaluation-execution"
export type { EvaluationPhase, EvaluationMetrics } from "./evaluation/types"

export function useEvaluationRunner(selectedRunId: string | null, observabilityHistory: ValidationRecord[]) {
    const state = useEvaluationState()
    const {
        loadConfigs,
        initializeAnalysisSteps: initSteps,
        updateStepStatus
    } = useEvaluationInitialization(state)

    const {
        handleConfigSelect,
        handleNewConfig,
        handleStrategyConfirm
    } = useEvaluationHandlers(state, updateStepStatus)

    const { runEvaluation } = useEvaluationExecution(state)

    const {
        validationSteps,
        configs,
        selectedConfig,
        currentPhase,
        evaluationIssues,
        evaluationMetrics,
        evaluationReasonings,
        isConfigDialogOpen,
        setIsConfigDialogOpen,
        lastSavedId,
        perturbationEngine,
        setValidationSteps,
        setConfigs,
        setSelectedConfig,
        setCurrentPhase,
        setEvaluationIssues,
        setEvaluationMetrics,
        setEvaluationReasonings,
        setLastSavedId,
        setPerturbationEngine,
        setRetrievedPrompts,
        setPerturbationConfig,
    } = state

    // --- Helpers ---

    const reset = useCallback(() => {
        setValidationSteps([])
        setConfigs([])
        setSelectedConfig(null)
        setCurrentPhase('initializing')
        setEvaluationIssues([])
        setEvaluationMetrics(null)
        setEvaluationReasonings(null)
        setPerturbationEngine(null)
        setRetrievedPrompts(null)
        setPerturbationConfig(null)
        setLastSavedId(null)
    }, [
        setValidationSteps, setConfigs, setSelectedConfig, setCurrentPhase,
        setEvaluationIssues, setEvaluationMetrics, setEvaluationReasonings,
        setPerturbationEngine, setRetrievedPrompts, setPerturbationConfig,
        setLastSavedId
    ])

    const initializeAnalysisSteps = useCallback(() => {
        initSteps(selectedRunId, observabilityHistory)
    }, [initSteps, selectedRunId, observabilityHistory])

    const getLoadingText = useCallback(() => {
        if (currentPhase === 'initializing') return "Initializing Engine...";
        if (currentPhase === 'running') {
            return "Sending prompts to LLM...";
        }
        if (!selectedRunId && validationSteps.some(s => s.id === 'building_prompts' && s.status === 'loading')) return "Building Prompts...";
        return "Processing...";
    }, [currentPhase, validationSteps, selectedRunId])

    return {
        // State
        validationSteps,
        configs,
        selectedConfig,
        currentPhase,
        evaluationIssues,
        evaluationMetrics,
        evaluationReasonings,
        isConfigDialogOpen,
        setIsConfigDialogOpen,
        lastSavedId,
        // Legacy/Compat
        perturbationEngine,

        // Actions
        loadConfigs,
        initializeAnalysisSteps,
        handleConfigSelect,
        handleNewConfig,
        handleStrategyConfirm,
        runEvaluation,
        getLoadingText,
        reset,
    }
}
