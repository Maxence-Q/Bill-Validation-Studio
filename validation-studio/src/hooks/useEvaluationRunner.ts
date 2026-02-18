"use client"

import { useState, useEffect, useCallback } from "react"
import { ValidationStep } from "@/components/validation/validation-progress"
import { Configuration } from "@/types/configuration"
import { CookieManager } from "@/lib/configuration/cookie-manager"
import { PerturbationEngine } from "@/lib/validation/perturbation-engine"
import { EvaluationIssue } from "@/components/evaluation/evaluation-issues-display"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { parsePromptFile } from "@/lib/validation/prompt-builder"

export type EvaluationPhase = 'initializing' | 'configuration' | 'perturbation_strategy' | 'ready' | 'running' | 'complete'

export interface EvaluationMetrics {
    precision: number
    recall: number
    tp: number
    fp: number
    fn: number
    moduleMetrics?: Record<string, any>
}

export function useEvaluationRunner(selectedRunId: string | null, observabilityHistory: ValidationRecord[]) {
    const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
    const [configs, setConfigs] = useState<Configuration[]>([])
    const [selectedConfig, setSelectedConfig] = useState<Configuration | null>(null)
    const [currentPhase, setCurrentPhase] = useState<EvaluationPhase>('initializing')
    const [evaluationIssues, setEvaluationIssues] = useState<EvaluationIssue[]>([])
    const [evaluationMetrics, setEvaluationMetrics] = useState<EvaluationMetrics | null>(null)
    const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)
    const [lastSavedId, setLastSavedId] = useState<string | null>(null)

    // Engine State (Legacy/Unused for most part now, but might be needed for UI transitions or if we keep some client logic)
    // We keep these to avoid breaking UI that might check for them, though we can probably remove them.
    const [perturbationEngine, setPerturbationEngine] = useState<PerturbationEngine | null>(null)
    const [retrievedPrompts, setRetrievedPrompts] = useState<any>(null)
    const [perturbationConfig, setPerturbationConfig] = useState<any>(null)

    // Dynamic Prompts State
    const [systemMessage, setSystemMessage] = useState<string>("")
    const [userPromptTemplate, setUserPromptTemplate] = useState<string>("")

    // --- Helpers ---

    const updateStepStatus = useCallback((id: string, status: ValidationStep['status'], error?: string) => {
        setValidationSteps(prev => prev.map(s => {
            if (s.id === id) return { ...s, status, error };
            return s;
        }));
    }, [])

    const reset = useCallback(() => {
        setValidationSteps([])
        setConfigs([])
        setSelectedConfig(null)
        setCurrentPhase('initializing')
        setEvaluationIssues([])
        setEvaluationMetrics(null)
        setPerturbationEngine(null)
        setRetrievedPrompts(null)
        setPerturbationConfig(null)
        setLastSavedId(null)
    }, [])

    // --- Initialization ---

    const loadConfigs = useCallback(() => {
        const saved = CookieManager.get("llm_configurations");
        if (saved) {
            try {
                setConfigs(JSON.parse(saved));
            } catch (e) { console.error(e); }
        }

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
    }, [])

    const initializeEngine = useCallback((isRunSelection: boolean) => {
        // Mocking engine initialization for UI consistency
        if (isRunSelection) updateStepStatus("perturbation_ready", "loading");

        setTimeout(() => {
            // We don't really need the engine client-side anymore, but we simulate it for now
            updateStepStatus("perturbation_ready", "success");
            updateStepStatus("config_wait", "loading");
            setCurrentPhase('configuration');
        }, 500);
    }, [updateStepStatus])

    const initializeAnalysisSteps = useCallback(() => {
        setCurrentPhase('initializing');
        setPerturbationEngine(null);
        setRetrievedPrompts(null);

        const isRunSelection = !!selectedRunId;
        let initialSteps: ValidationStep[] = [];

        if (isRunSelection) {
            initialSteps = [
                { id: "retrieval", label: "Retrieval of previous prompts", status: "loading" },
                { id: "perturbation_ready", label: "Perturbation Engine Ready", status: "pending" },
                { id: "config_wait", label: "Waiting for Configuration...", status: "pending" },
                { id: "strategy_wait", label: "Configuring perturbations strategy...", status: "pending" },
                { id: "server_processing", label: "Sending prompts to LLM...", status: "pending" },
            ];
            setValidationSteps(initialSteps);

            setTimeout(() => {
                const record = observabilityHistory.find(r => r.id === selectedRunId);
                if (record && record.prompts) {
                    console.log("Retrieval successful: Found prompts for run", selectedRunId);
                    setRetrievedPrompts(record.prompts); // Still keeping this for maybe passing to server if needed?
                    // Actually server fetches its own or we send validation input. 
                    // If we are evaluating a PAST run, we might need to send the PAST prompts?
                    // The orchestration logic currently uses RAG to fetch fresh context.
                    // If we want to evaluate a SPECIFIC past run's prompts, we need to handle that.
                    // For now, let's assume we are re-running validation mainly.
                    // But wait, the 'Evaluation' page is often about testing robustness of prompts or model.
                    // If 'selectedRunId' is passed, we usually want to re-eval THAT event.

                    updateStepStatus("retrieval", "success");
                    initializeEngine(true);
                } else {
                    console.error("Retrieval failed: No record or prompts found for", selectedRunId);
                    updateStepStatus("retrieval", "error", "Prompts not found in history.");
                }
            }, 800);
        } else {
            // New Evaluation
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
    }, [selectedRunId, observabilityHistory, updateStepStatus, initializeEngine])

    // --- Config Selection ---

    const handleConfigSelect = useCallback((config: Configuration) => {
        setSelectedConfig(config);
        console.log("Configuration selected:", config.name);

        setValidationSteps(prev => prev.map(s => {
            if (s.id === 'config_wait') return { ...s, status: 'success' as const, label: 'Configuration Ready' };
            return s;
        }));

        updateStepStatus("strategy_wait", "loading");
        setCurrentPhase('perturbation_strategy');
    }, [updateStepStatus])

    const handleNewConfig = useCallback((newConfig: Configuration) => {
        const updatedConfigs = [...configs, newConfig];
        setConfigs(updatedConfigs);
        CookieManager.set("llm_configurations", JSON.stringify(updatedConfigs), { expires: 365 });
        setIsConfigDialogOpen(false);
        handleConfigSelect(newConfig);
    }, [configs, handleConfigSelect])

    // --- Strategy ---

    const handleStrategyConfirm = useCallback((config: any) => {
        console.log("Strategy Config:", config);
        setPerturbationConfig(config);
        updateStepStatus("strategy_wait", "success");
        setCurrentPhase('ready');
    }, [updateStepStatus])

    // --- Execution ---

    const runEvaluation = useCallback(async (
        targetEvent: any,
        config: Configuration,
        ptConfig: any | null // passed from UI or state
    ) => {
        if (!targetEvent || !config) return;

        // Use passed config or state config
        const finalPerturbationConfig = ptConfig || perturbationConfig;

        setEvaluationIssues([]);
        setEvaluationMetrics(null);
        setCurrentPhase('running');

        // Reset steps for a clean run
        // We keep 'init' or previous steps if we want, but let's just focus on processing
        setValidationSteps(prev => {
            // Keep successful setup steps
            const keep = prev.filter(s => s.status === 'success');
            return [...keep, { id: "server_processing", label: "Sending prompts to LLM...", status: "loading" }];
        });

        try {
            const response = await fetch("/api/evaluation/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetEvent,
                    config,
                    perturbationConfig: finalPerturbationConfig
                })
            });

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                // The last line might be incomplete
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);

                        if (data.type === "progress") {
                            // Update progress UI
                            setValidationSteps(prev => {
                                const stepId = `module_${data.module}`;
                                const existing = prev.find(s => s.id === stepId);

                                // Insert after server_processing or at end
                                if (!existing) {
                                    return [...prev, {
                                        id: stepId,
                                        label: `Evaluating ${data.module} (${data.current}/${data.total})`,
                                        status: data.status === 'completed' ? "success" : "loading"
                                    }];
                                }
                                return prev.map(s => s.id === stepId ? {
                                    ...s,
                                    label: `Evaluating ${data.module} (${data.current}/${data.total})`,
                                    status: data.status === 'completed' ? "success" : "loading"
                                } : s);
                            });
                        } else if (data.type === "result") {
                            setEvaluationIssues(data.issues || []);
                            if (data.metrics) {
                                setEvaluationMetrics(data.metrics);
                            }

                            // Mark all as success and calculate counts
                            setValidationSteps(prev => prev.map(s => {
                                if (s.id === 'server_processing') return { ...s, status: 'success' };

                                if (s.id.startsWith('module_')) {
                                    const modName = s.id.replace('module_', '');
                                    const modIssues = data.issues ? data.issues.filter((iss: any) => iss.module === modName) : [];

                                    const errorCount = modIssues.filter((iss: any) => iss.severity === 'error').length;
                                    const warningCount = modIssues.filter((iss: any) => iss.severity === 'warning').length;
                                    const infoCount = modIssues.filter((iss: any) => iss.severity === 'info').length;

                                    let finalStatus: 'success' | 'error' | 'warning' = 'success';
                                    if (errorCount > 0) finalStatus = 'error';
                                    else if (warningCount > 0) finalStatus = 'warning';

                                    return {
                                        ...s,
                                        status: finalStatus,
                                        issueCounts: {
                                            error: errorCount,
                                            warning: warningCount,
                                            info: infoCount
                                        }
                                    };
                                }

                                if (s.status === 'loading') return { ...s, status: 'success' };
                                return s;
                            }));
                            setCurrentPhase('complete');
                        } else if (data.type === "error") {
                            console.error("Stream error:", data.message);
                            setValidationSteps(prev => [...prev, { id: "error", label: `Error: ${data.message}`, status: "error" }]);
                        }

                    } catch (e) {
                        console.error("Error parsing stream line", e);
                    }
                }
            }

        } catch (error: any) {
            console.error("Evaluation failed:", error);
            updateStepStatus("server_processing", "error", error.message);
        }
    }, [perturbationConfig, updateStepStatus]);

    // --- Loading Text ---

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
