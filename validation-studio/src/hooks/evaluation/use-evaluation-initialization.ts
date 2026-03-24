import { useCallback } from "react"
import { parsePromptFile } from "@/lib/validation/prompt-builder"
import { EvaluationState } from "./types"

import { ValidationRecord } from "@/lib/configuration/storage-core"

export function useEvaluationInitialization(state: EvaluationState) {
    const {
        setConfigs,
        setSystemMessage,
        setUserPromptTemplate,
        setValidationSteps,
        setCurrentPhase,
        setPerturbationEngine,
        setRetrievedPrompts,
    } = state

    const updateStepStatus = useCallback((id: string, status: any, error?: string) => {
        setValidationSteps(prev => prev.map(s => {
            if (s.id === id) return { ...s, status, error };
            return s;
        }));
    }, [setValidationSteps])

    const loadConfigs = useCallback(() => {
        // Load configurations
        fetch("/api/configurations")
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                if (Array.isArray(data)) {
                    setConfigs(data);
                }
            })
            .catch(err => console.error("Failed to load configurations:", err));

        // Load Prompts
        fetch("/api/tools/prompts?lang=en")
            .then(res => res.json())
            .then(data => {
                if (data.content) {
                    const parsed = parsePromptFile(data.content);
                    setSystemMessage(parsed.systemMessage);
                    setUserPromptTemplate(parsed.userPromptTemplate);
                }
            })
            .catch(err => console.error("Failed to load prompts:", err));
    }, [setConfigs, setSystemMessage, setUserPromptTemplate])

    const initializeEngine = useCallback((isRunSelection: boolean) => {
        if (isRunSelection) updateStepStatus("perturbation_ready", "loading");

        setTimeout(() => {
            updateStepStatus("perturbation_ready", "success");
            updateStepStatus("config_wait", "loading");
            setCurrentPhase('configuration');
        }, 500);
    }, [updateStepStatus, setCurrentPhase])

    const initializeAnalysisSteps = useCallback((selectedRunId: string | null, observabilityHistory: ValidationRecord[]) => {
        setCurrentPhase('initializing');
        setPerturbationEngine(null);
        setRetrievedPrompts(null);

        const isRunSelection = !!selectedRunId;
        let initialSteps: any[] = [];

        if (isRunSelection) {
            initialSteps = [
                { id: "retrieval", label: "Validating previous run reference", status: "loading" },
                { id: "perturbation_ready", label: "Perturbation Engine Ready", status: "pending" },
                { id: "config_wait", label: "Waiting for Configuration...", status: "pending" },
                { id: "strategy_wait", label: "Configuring perturbations strategy...", status: "pending" },
                { id: "server_processing", label: "Sending prompts to LLM...", status: "pending" },
            ];
            setValidationSteps(initialSteps);

            setTimeout(() => {
                const record = observabilityHistory.find(r => r.id === selectedRunId);
                if (record) {
                    console.log("Retrieval successful: Found run", selectedRunId);
                    updateStepStatus("retrieval", "success");
                    initializeEngine(true);
                } else {
                    console.error("Retrieval failed: No record found for ID", selectedRunId);
                    updateStepStatus("retrieval", "error", "Record not found in history.");
                }
            }, 800);
        } else {
            initialSteps = [
                { id: "format", label: "User's event fulfill expected format", status: "success" },
                { id: "perturbation_ready", label: "Perturbation Engine Ready", status: "loading" },
                { id: "config_wait", label: "Waiting for Configuration...", status: "pending" },
                { id: "strategy_wait", label: "Configuring perturbations strategy...", status: "pending" },
                { id: "server_processing", label: "Sending prompts to LLM...", status: "pending" },
            ];
            setValidationSteps(initialSteps);
            initializeEngine(false);
        }
    }, [setCurrentPhase, setPerturbationEngine, setRetrievedPrompts, setValidationSteps, updateStepStatus, initializeEngine])

    return {
        loadConfigs,
        initializeAnalysisSteps,
        updateStepStatus
    }
}
