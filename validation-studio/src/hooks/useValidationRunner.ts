"use client"

import { useState, useCallback, useRef } from "react"
import { ValidationStep } from "@/components/validation/validation-progress"
import { ValidationIssue } from "@/types/validation"
import { CookieManager } from "@/lib/configuration/cookie-manager"
import { Configuration } from "@/types/configuration"

export function useValidationRunner() {
    const [isValidationStarted, setIsValidationStarted] = useState(false)
    const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])
    const abortControllerRef = useRef<AbortController | null>(null)
    const validationStartTimeRef = useRef<number | null>(null)

    const resetValidation = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
        }
        setIsValidationStarted(false)
        setValidationSteps([])
        setValidationIssues([])
    }, [])

    const startValidation = useCallback(async (eventData: any) => {
        // Cancel any previous validation
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        const controller = new AbortController()
        abortControllerRef.current = controller
        const signal = controller.signal

        setIsValidationStarted(true)
        setValidationSteps([])
        setValidationIssues([])

        // Initialize UI Steps
        const steps: ValidationStep[] = [
            { id: "init", label: "Initializing Validation...", status: "loading" },
            { id: "server_processing", label: "Sending Prompts to LLM", status: "pending", subSteps: [] }
        ];
        setValidationSteps(steps);
        validationStartTimeRef.current = Date.now();

        try {
            // 1. Get Configuration
            const savedConfigs = CookieManager.get("llm_configurations");
            if (!savedConfigs) throw new Error("No configurations found. Go to 'Configuration' page.");

            const parsed = JSON.parse(savedConfigs) as Configuration[];
            if (!parsed || parsed.length === 0) throw new Error("Configuration list is empty.");

            const config = parsed[0]; // Use first config active

            setValidationSteps(prev => prev.map(s => s.id === "init" ? { ...s, status: "success" } : s));
            setValidationSteps(prev => prev.map(s => s.id === "server_processing" ? { ...s, status: "loading" } : s));

            // 2. Call Validation API
            const response = await fetch("/api/evaluation/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetEvent: eventData,
                    config: config,
                    perturbationConfig: null, // Standard validation
                    storageType: 'validation' // Important: Save to validation_history
                }),
                signal
            });

            if (!response.body) throw new Error("No response body");
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Validation failed");
            }

            // 3. Process Stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let allIssues: ValidationIssue[] = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const msg = JSON.parse(line) as import("@/types/validation").StreamMessage;

                        if (msg.type === "progress") {
                            setValidationSteps(prev => {
                                const stepId = `module_${msg.module}`;

                                return prev.map(s => {
                                    if (s.id !== "server_processing") return s;

                                    const subSteps = s.subSteps || [];
                                    const existing = subSteps.find(ss => ss.id === stepId);

                                    const newSubStep: ValidationStep = {
                                        id: stepId,
                                        label: `Validating ${msg.module} (${msg.current}/${msg.total})`,
                                        status: (msg as any).status === 'completed' ? 'success' : 'loading'
                                    };

                                    // Handle global ETA calculation
                                    const now = Date.now();
                                    const valStartTime = validationStartTimeRef.current || now;
                                    const elapsedSeconds = (now - valStartTime) / 1000;

                                    let globalProgress = undefined;
                                    if (msg.global) {
                                        let estimatedSeconds = undefined;
                                        if (msg.global.completedSubPrompts > 0) {
                                            estimatedSeconds = (elapsedSeconds / msg.global.completedSubPrompts) * msg.global.totalSubPrompts;
                                        }
                                        globalProgress = {
                                            ...msg.global,
                                            elapsedSeconds,
                                            estimatedSeconds
                                        };
                                    }

                                    if (!existing) {
                                        // Finalize previous sub-steps
                                        const updatedSubSteps = subSteps.map(ss => {
                                            if (ss.status === 'loading') {
                                                const modName = ss.id.replace('module_', '');
                                                const modIssues = allIssues.filter(iss => iss.module === modName);
                                                const errorCount = modIssues.filter(iss => iss.severity === 'error').length;
                                                const warningCount = modIssues.filter(iss => iss.severity === 'warning').length;

                                                let finalStatus: 'success' | 'error' | 'warning' = 'success';
                                                if (errorCount > 0) finalStatus = 'error';
                                                else if (warningCount > 0) finalStatus = 'warning';

                                                const infoCount = modIssues.filter(iss => iss.severity === 'info').length;

                                                return {
                                                    ...ss,
                                                    status: finalStatus,
                                                    issueCounts: {
                                                        error: errorCount,
                                                        warning: warningCount,
                                                        info: infoCount
                                                    }
                                                };
                                            }
                                            return ss;
                                        });
                                        return { ...s, subSteps: [...updatedSubSteps, newSubStep], globalProgress };
                                    }

                                    return {
                                        ...s,
                                        subSteps: subSteps.map(ss => ss.id === stepId ? newSubStep : ss),
                                        globalProgress
                                    };
                                });
                            });
                        } else if (msg.type === "result") {
                            if (msg.issues) {
                                allIssues = msg.issues;
                                setValidationIssues(msg.issues);
                            }

                            // Mark ALL remaining loading steps as success/error based on issues
                            setValidationSteps(prev => prev.map(s => {
                                if (s.id === "server_processing") {
                                    const updatedSubSteps = (s.subSteps || []).map(ss => {
                                        const modName = ss.id.replace('module_', '');
                                        const modIssues = msg.issues ? msg.issues.filter(iss => iss.module === modName) : [];
                                        const errorCount = modIssues.filter(iss => iss.severity === 'error').length;
                                        const warningCount = modIssues.filter(iss => iss.severity === 'warning').length;

                                        let finalStatus: 'success' | 'error' | 'warning' = 'success';
                                        if (errorCount > 0) finalStatus = 'error';
                                        else if (warningCount > 0) finalStatus = 'warning';

                                        const infoCount = modIssues.filter(iss => iss.severity === 'info').length;

                                        return {
                                            ...ss,
                                            status: finalStatus,
                                            issueCounts: {
                                                error: errorCount,
                                                warning: warningCount,
                                                info: infoCount
                                            }
                                        };
                                    });
                                    return { ...s, status: 'success', subSteps: updatedSubSteps };
                                }

                                if (s.status === 'loading') {
                                    return { ...s, status: 'success' };
                                }
                                return s;
                            }));
                        } else if (msg.type === "error") {
                            throw new Error(msg.message);
                        }
                    } catch (e) {
                        console.error("Error parsing stream line", e);
                    }
                }
            }

            setIsValidationStarted(false);

        } catch (error) {
            if (signal.aborted) {
                console.log("Validation cancelled");
                return;
            }
            console.error("Validation error:", error);
            setValidationSteps(prev => {
                const updated = prev.map(s => {
                    if (s.status === 'loading') {
                        return {
                            ...s,
                            status: 'error' as const,
                            subSteps: s.subSteps?.map(ss => ss.status === 'loading' ? { ...ss, status: 'error' as const } : ss)
                        };
                    }
                    return s;
                });
                return [
                    ...updated,
                    { id: "error", label: `Error: ${error instanceof Error ? error.message : "Unknown error"}`, status: "error" }
                ];
            });
            setIsValidationStarted(false);
        }
    }, [])

    return {
        isValidationStarted,
        validationSteps,
        validationIssues,
        startValidation,
        resetValidation,
    }
}
