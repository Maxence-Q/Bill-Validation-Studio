import { useCallback } from "react"
import { Configuration } from "@/types/configuration"
import { EvaluationState } from "./types"

export function useEvaluationExecution(state: EvaluationState) {
    const {
        perturbationConfig,
        setEvaluationIssues,
        setEvaluationMetrics,
        setEvaluationReasonings,
        setValidationSteps,
        setCurrentPhase,
        validationStartTime,
        setValidationStartTime,
    } = state

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
        const startTime = Date.now();
        setValidationStartTime(startTime);

        // Reset steps for a clean run
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

                                // Handle global ETA calculation
                                const now = Date.now();
                                const valStartTime = startTime;
                                const elapsedSeconds = (now - valStartTime) / 1000;

                                let globalProgress = undefined;
                                if (data.global) {
                                    let estimatedSeconds = undefined;
                                    if (data.global.completedSubPrompts > 0) {
                                        estimatedSeconds = (elapsedSeconds / data.global.completedSubPrompts) * data.global.totalSubPrompts;
                                    }
                                    globalProgress = {
                                        ...data.global,
                                        elapsedSeconds,
                                        estimatedSeconds
                                    };
                                }

                                const updateServerProcessing = (steps: any[]) => steps.map(s =>
                                    s.id === "server_processing" ? { ...s, globalProgress } : s
                                );

                                // Insert after server_processing or at end
                                if (!existing) {
                                    const newSubStep = {
                                        id: stepId,
                                        label: `Evaluating ${data.module} (${data.current}/${data.total})`,
                                        status: data.status === 'completed' ? "success" : "loading"
                                    };
                                    return updateServerProcessing([...prev, newSubStep]);
                                }
                                return updateServerProcessing(prev.map(s => s.id === stepId ? {
                                    ...s,
                                    label: `Evaluating ${data.module} (${data.current}/${data.total})`,
                                    status: data.status === 'completed' ? "success" : "loading"
                                } : s));
                            });
                        } else if (data.type === "result") {
                            setEvaluationIssues(data.issues || []);
                            if (data.metrics) {
                                setEvaluationMetrics(data.metrics);
                            }
                            if (data.reasonings) {
                                setEvaluationReasonings(data.reasonings);
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
            // We need a way to call updateStepStatus here, or we can just use setValidationSteps
            setValidationSteps(prev => prev.map(s => {
                if (s.id === "server_processing") return { ...s, status: "error", error: error.message };
                return s;
            }));
        }
    }, [perturbationConfig, setEvaluationIssues, setEvaluationMetrics, setEvaluationReasonings, setValidationSteps, setCurrentPhase]);

    return { runEvaluation }
}
