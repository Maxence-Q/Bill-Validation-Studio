"use client"

import { useState, useEffect, useCallback } from "react"
import { ValidationStep } from "@/components/validation/validation-progress"
import { Configuration } from "@/types/configuration"
import { CookieManager } from "@/lib/configuration/cookie-manager"
import { PerturbationEngine } from "@/lib/evaluation/perturbation-engine"
import { EvaluationIssue } from "@/components/evaluation/evaluation-issues-display"
import { ValidationRecord } from "@/lib/configuration/storage-core"

export type EvaluationPhase = 'initializing' | 'configuration' | 'perturbation_strategy' | 'ready' | 'running' | 'complete'

export interface EvaluationMetrics {
    precision: number
    recall: number
    tp: number
    fp: number
    fn: number
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

    // Engine State
    const [perturbationEngine, setPerturbationEngine] = useState<PerturbationEngine | null>(null)
    const [retrievedPrompts, setRetrievedPrompts] = useState<any>(null)
    const [perturbationConfig, setPerturbationConfig] = useState<any>(null)

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
    }, [])

    const initializeEngine = useCallback((isRunSelection: boolean) => {
        if (isRunSelection) updateStepStatus("perturbation_ready", "loading");

        setTimeout(() => {
            try {
                const engine = new PerturbationEngine();
                setPerturbationEngine(engine);
                console.log("Perturbation Engine instantiated successfully.");

                updateStepStatus("perturbation_ready", "success");
                updateStepStatus("config_wait", "loading");
                setCurrentPhase('configuration');
            } catch (e) {
                console.error("Failed to instantiate PerturbationEngine", e);
                updateStepStatus("perturbation_ready", "error");
            }
        }, 800);
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
                { id: "injecting", label: "Injecting perturbations...", status: "pending" },
                { id: "llm_call", label: "Sending prompts to the LLM...", status: "pending" },
            ];
            setValidationSteps(initialSteps);

            setTimeout(() => {
                const record = observabilityHistory.find(r => r.id === selectedRunId);
                if (record && record.prompts) {
                    console.log("Retrieval successful: Found prompts for run", selectedRunId);
                    setRetrievedPrompts(record.prompts);
                    updateStepStatus("retrieval", "success");
                    initializeEngine(true);
                } else {
                    console.error("Retrieval failed: No record or prompts found for", selectedRunId);
                    updateStepStatus("retrieval", "error", "Prompts not found in history.");
                }
            }, 800);
        } else {
            initialSteps = [
                { id: "format", label: "User's event fulfill expected format", status: "success" },
                { id: "perturbation_ready", label: "Perturbation Engine Ready", status: "loading" },
                { id: "config_wait", label: "Waiting for Configuration...", status: "pending" },
                { id: "building_prompts", label: "Building prompts...", status: "pending" },
                { id: "prompts_ready", label: "All prompts ready", status: "pending" },
                { id: "strategy_wait", label: "Configuring perturbations strategy...", status: "pending" },
                { id: "injecting", label: "Injecting perturbations...", status: "pending" },
                { id: "llm_call", label: "Sending prompts to the LLM...", status: "pending" },
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

        if (!selectedRunId) {
            // Upload mode extra steps
            setValidationSteps(prev => prev.map(s => s.id === 'building_prompts' ? { ...s, status: 'loading' as const } : s));
            setCurrentPhase('initializing');

            setTimeout(() => {
                setValidationSteps(prev => prev.map(s => {
                    if (s.id === 'building_prompts') return { ...s, status: 'success' as const };
                    if (s.id === 'prompts_ready') return { ...s, status: 'success' as const };
                    if (s.id === 'strategy_wait') return { ...s, status: 'loading' as const };
                    return s;
                }));
                setCurrentPhase('perturbation_strategy');
            }, 1500);
        } else {
            updateStepStatus("strategy_wait", "loading");
            setCurrentPhase('perturbation_strategy');
        }
    }, [selectedRunId, updateStepStatus])

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

    // --- Run Evaluation ---

    const runEvaluation = useCallback(async () => {
        setCurrentPhase('running');
        updateStepStatus("injecting", "loading");

        if (!perturbationEngine || !retrievedPrompts || !perturbationConfig) {
            console.log("Missing engine, prompts, or config");
            updateStepStatus("injecting", "error");
            return;
        }

        // --- Step 1: Inject Perturbations (with tracking) ---
        console.log("Applying perturbations with config:", perturbationConfig);

        const perturbedPrompts: Record<string, string[]> = {};
        const allPerturbedPaths: Record<string, string[][]> = {};
        const allPerturbationDetails: Record<string, { path: string; original: string; perturbed: string }[][]> = {};

        Object.keys(retrievedPrompts).forEach(moduleKey => {
            const modulePrompts = retrievedPrompts[moduleKey];
            if (Array.isArray(modulePrompts)) {
                perturbedPrompts[moduleKey] = [];
                allPerturbedPaths[moduleKey] = [];
                allPerturbationDetails[moduleKey] = [];
                modulePrompts.forEach((prompt: string) => {
                    if (typeof prompt === 'string') {
                        const result = perturbationEngine.injectPerturbationsWithTracking(prompt, perturbationConfig);
                        perturbedPrompts[moduleKey].push(result.prompt);
                        allPerturbedPaths[moduleKey].push(result.perturbedPaths);
                        allPerturbationDetails[moduleKey].push(result.perturbationDetails);
                    } else {
                        perturbedPrompts[moduleKey].push(prompt);
                        allPerturbedPaths[moduleKey].push([]);
                        allPerturbationDetails[moduleKey].push([]);
                    }
                });
            }
        });

        console.log("Perturbations applied. Stats:", perturbationEngine.getStats());
        updateStepStatus("injecting", "success");

        // --- Step 2: Send to LLM ---
        const MODULES = Object.keys(perturbedPrompts);
        setValidationSteps(prev => prev.map(s => {
            if (s.id === "llm_call") {
                return {
                    ...s,
                    status: "loading" as const,
                    label: "Sending prompts to the LLM...",
                    subSteps: MODULES.map(m => ({
                        id: `llm-${m}`,
                        label: `${m}`,
                        status: "pending" as const
                    }))
                };
            }
            return s;
        }));

        const allPromptEntries: { module: string; index: number; prompt: string; perturbedPaths: string[] }[] = [];
        Object.entries(perturbedPrompts).forEach(([moduleKey, prompts]) => {
            prompts.forEach((prompt, i) => {
                allPromptEntries.push({
                    module: moduleKey,
                    index: i,
                    prompt,
                    perturbedPaths: allPerturbedPaths[moduleKey]?.[i] || []
                });
            });
        });

        console.log(`Sending ${allPromptEntries.length} perturbed prompts to LLM...`);

        const moduleTotals: Record<string, number> = {};
        const moduleCompleted: Record<string, number> = {};
        allPromptEntries.forEach(e => {
            moduleTotals[e.module] = (moduleTotals[e.module] || 0) + 1;
            moduleCompleted[e.module] = 0;
        });

        let allIssues: any[] = [];
        let completed = 0;
        let currentModule = "";

        for (const entry of allPromptEntries) {
            if (entry.module !== currentModule) {
                currentModule = entry.module;
                setValidationSteps(prev => prev.map(s => {
                    if (s.id === "llm_call") {
                        return {
                            ...s,
                            subSteps: s.subSteps?.map(sub =>
                                sub.id === `llm-${currentModule}` ? {
                                    ...sub,
                                    status: "loading" as const,
                                    progress: { current: 0, total: moduleTotals[currentModule] }
                                } : sub
                            )
                        };
                    }
                    return s;
                }));
            }

            try {
                const res = await fetch("/api/evaluation/llm", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt: entry.prompt })
                });

                if (res.status === 429) {
                    console.error("Rate limit reached, stopping.");
                    allIssues.push({ severity: "error", module: entry.module, path: "API_LIMIT", message: "Rate limit reached. Partial results." });
                    setValidationSteps(prev => prev.map(s => {
                        if (s.id === "llm_call") {
                            return {
                                ...s,
                                subSteps: s.subSteps?.map(sub =>
                                    sub.id === `llm-${entry.module}` ? { ...sub, status: "error" as const, error: "Rate limit" } : sub
                                )
                            };
                        }
                        return s;
                    }));
                    break;
                }

                if (res.ok) {
                    const data = await res.json();
                    if (data.issues && data.issues.length > 0) {
                        const enriched = data.issues.map((issue: any) => ({ ...issue, module: entry.module, itemIndex: entry.index }));
                        allIssues = [...allIssues, ...enriched];
                    }
                } else {
                    console.error(`LLM call failed for ${entry.module}[${entry.index}]:`, res.status);
                }

                completed++;
                moduleCompleted[entry.module]++;
                console.log(`LLM progress: ${completed}/${allPromptEntries.length} (${entry.module} ${moduleCompleted[entry.module]}/${moduleTotals[entry.module]})`);

                const isDone = moduleCompleted[entry.module] >= moduleTotals[entry.module];
                setValidationSteps(prev => prev.map(s => {
                    if (s.id === "llm_call") {
                        return {
                            ...s,
                            subSteps: s.subSteps?.map(sub =>
                                sub.id === `llm-${entry.module}` ? {
                                    ...sub,
                                    status: isDone ? "success" as const : "loading" as const,
                                    progress: { current: moduleCompleted[entry.module], total: moduleTotals[entry.module] }
                                } : sub
                            )
                        };
                    }
                    return s;
                }));

            } catch (err) {
                console.error(`Error calling LLM for ${entry.module}[${entry.index}]:`, err);
                completed++;
                moduleCompleted[entry.module]++;
            }
        }

        console.log(`LLM complete. ${allIssues.length} issues found.`);

        // --- Step 3: Compute Precision / Recall with Module Breakdown ---
        const allPerturbedPathsFlat = allPromptEntries.flatMap(e =>
            e.perturbedPaths.map(p => ({ module: e.module, index: e.index, path: p }))
        );
        const totalPerturbations = allPerturbedPathsFlat.length;

        // Initialize Module Stats
        const moduleStats: Record<string, { tp: number, fp: number, total: number }> = {};
        // Ensure all modules are initialized
        allPromptEntries.forEach(e => {
            if (!moduleStats[e.module]) {
                moduleStats[e.module] = { tp: 0, fp: 0, total: 0 };
            }
        });

        // Count totals per module
        allPerturbedPathsFlat.forEach(p => {
            if (moduleStats[p.module]) moduleStats[p.module].total++;
        });

        const matchedPerturbations = new Set<number>();
        let globalTp = 0;
        let globalFp = 0;

        for (const issue of allIssues) {
            if (issue.path === "API_LIMIT") continue;

            const issuePath = issue.path || "";
            const matchIdx = allPerturbedPathsFlat.findIndex((p, idx) => {
                if (matchedPerturbations.has(idx)) return false;
                if (p.module !== issue.module) return false;
                return p.path === issuePath || issuePath.includes(p.path) || p.path.includes(issuePath);
            });

            if (matchIdx !== -1) {
                globalTp++;
                matchedPerturbations.add(matchIdx);
                if (moduleStats[issue.module]) moduleStats[issue.module].tp++;
                issue.classification = 'TP';
            } else {
                globalFp++;
                if (issue.module && moduleStats[issue.module]) moduleStats[issue.module].fp++;
                issue.classification = 'FP';
            }
        }

        const globalFn = totalPerturbations - globalTp;
        const globalPrecision = (globalTp + globalFp) > 0 ? globalTp / (globalTp + globalFp) : 1;
        const globalRecall = totalPerturbations > 0 ? globalTp / totalPerturbations : 1;

        // Compute per-module metrics
        const moduleMetrics: Record<string, any> = {};
        Object.keys(moduleStats).forEach(m => {
            const stats = moduleStats[m];
            const fn = stats.total - stats.tp;
            const precision = (stats.tp + stats.fp) > 0 ? stats.tp / (stats.tp + stats.fp) : 1;
            const recall = stats.total > 0 ? stats.tp / stats.total : 1;
            moduleMetrics[m] = {
                precision,
                recall,
                tp: stats.tp,
                fp: stats.fp,
                fn
            };
        });

        console.log(`Global Metrics: TP=${globalTp}, FP=${globalFp}, FN=${globalFn}, Precision=${(globalPrecision * 100).toFixed(1)}%, Recall=${(globalRecall * 100).toFixed(1)}%`);

        setEvaluationIssues(allIssues);
        setEvaluationMetrics({ precision: globalPrecision, recall: globalRecall, tp: globalTp, fp: globalFp, fn: globalFn });
        updateStepStatus("llm_call", "success");
        setCurrentPhase('complete');

        // --- Step 4: Save evaluation to history ---
        const sourceRecord = observabilityHistory.find(r => r.id === selectedRunId);
        try {
            const saveRes = await fetch("/api/evaluation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventId: sourceRecord?.eventId || "unknown",
                    eventName: sourceRecord?.eventName || "Unknown Event",
                    status: "success",
                    issues: allIssues,
                    prompts: perturbedPrompts,
                    perturbations: allPerturbationDetails,
                    metrics: { precision: globalPrecision, recall: globalRecall, tp: globalTp, fp: globalFp, fn: globalFn },
                    moduleMetrics: moduleMetrics
                }),
            });
            if (saveRes.ok) {
                const saveData = await saveRes.json();
                setLastSavedId(saveData.id);
                console.log("Evaluation saved to history:", saveData.id);
            } else {
                console.error("Failed to save evaluation to history");
            }
        } catch (err) {
            console.error("Error saving evaluation:", err);
        }
    }, [perturbationEngine, retrievedPrompts, perturbationConfig, updateStepStatus, observabilityHistory, selectedRunId])

    // --- Loading Text ---

    const getLoadingText = useCallback(() => {
        if (currentPhase === 'initializing') return "Initializing Engine...";
        if (currentPhase === 'running') {
            const llmStep = validationSteps.find(s => s.id === 'llm_call');
            if (llmStep?.status === 'loading') return "Sending prompts to the LLM...";
            return "Injecting Perturbations...";
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
