"use client"

import { useState, useCallback, useRef } from "react"
import { ValidationStep } from "@/components/validation/validation-progress"
import { ValidationIssue } from "@/components/validation/issues-display"
import { CookieManager } from "@/lib/configuration/cookie-manager"
import { Configuration } from "@/types/configuration"

export function useValidationRunner() {
    const [isValidationStarted, setIsValidationStarted] = useState(false)
    const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([])
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([])
    const abortControllerRef = useRef<AbortController | null>(null)

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

        let systemMessage = ""
        let userPrompt = ""

        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

        // --- STEP 1: Validate JSON Structure ---
        const step1: ValidationStep = { id: "structure", label: "User's event fulfill expected format", status: "loading" }
        setValidationSteps([step1])

        await delay(1000)

        const requiredKeys = ["Event", "OwnerPOS", "EventDates", "FeeDefinitions", "PriceGroups", "Prices", "RightToSellAndFees"]
        const missingKeys = requiredKeys.filter(key => !eventData[key])
        const hasId = eventData.Event?.Event?.ID !== undefined

        if (missingKeys.length > 0) {
            setValidationSteps(prev => prev.map(s => s.id === "structure" ? { ...s, status: "error", error: `Missing required keys: ${missingKeys.join(", ")}` } : s))
            return
        }

        if (!hasId) {
            setValidationSteps(prev => prev.map(s => s.id === "structure" ? { ...s, status: "error", error: "Missing Event ID at Event.Event.ID" } : s))
            return
        }

        setValidationSteps(prev => prev.map(s => s.id === "structure" ? { ...s, status: "success" } : s))

        // --- STEP 2: Fetch Configs and Tools ---
        const step2: ValidationStep = { id: "configs", label: "Configs and Tools correctly fetched", status: "loading" }
        setValidationSteps(prev => [...prev, step2])

        await delay(1000)

        try {
            const [promptsRes, toolsRes] = await Promise.all([
                fetch("/api/tools/prompts?lang=en", { signal }),
                fetch("/api/tools/definitions?lang=en", { signal })
            ])

            if (!promptsRes.ok || !toolsRes.ok) throw new Error("Failed to fetch configuration files")

            const promptsData = await promptsRes.json()
            const toolsData = await toolsRes.json()

            const fullPromptContent = promptsData.content || ""
            systemMessage = fullPromptContent.split("SYSTEM_MESSAGE =")[1]?.split("USER_PROMPT =")[0]?.trim()
            userPrompt = fullPromptContent.split("USER_PROMPT =")[1]?.trim()

            if (!systemMessage || !userPrompt) {
                setValidationSteps(prev => prev.map(s => s.id === "configs" ? { ...s, status: "error", error: "Failed to parse SYSTEM_MESSAGE or USER_PROMPT from prompts_en.md" } : s))
                return
            }

            if (!toolsData.content || toolsData.content === "{}" || (typeof toolsData.content === 'string' && toolsData.content.length < 10)) {
                setValidationSteps(prev => prev.map(s => s.id === "configs" ? { ...s, status: "error", error: "tools_en.json appears empty or invalid" } : s))
                return
            }

            const savedConfigs = CookieManager.get("llm_configurations")
            if (!savedConfigs) throw new Error("No configurations found. Go to 'Configuration' page.")

            const parsedConfigs = JSON.parse(savedConfigs) as Configuration[]
            if (!parsedConfigs || parsedConfigs.length === 0) throw new Error("Configuration list is empty. Create a configuration first.")

            const activeConfig = parsedConfigs[0]
            if (typeof activeConfig.references !== 'number' || activeConfig.references < 1) {
                throw new Error("Invalid reference count in configuration")
            }

            setValidationSteps(prev => prev.map(s => s.id === "configs" ? { ...s, status: "success" } : s))

        } catch (error) {
            if (signal.aborted) return
            console.error(error)
            setValidationSteps(prev => prev.map(s => s.id === "configs" ? { ...s, status: "error", error: error instanceof Error ? error.message : "Network error fetching configurations" } : s))
            return
        }

        // --- STEP 3: Context Retrieval ---
        const step3: ValidationStep = { id: "context", label: "Retrieving context references...", status: "loading" }
        setValidationSteps(prev => [...prev, step3])

        let contextDataResult: any = null;

        await delay(1000)

        try {
            const savedConfigs = CookieManager.get("llm_configurations")
            if (!savedConfigs) throw new Error("No configurations found")

            const parsedConfigs = JSON.parse(savedConfigs) as Configuration[]
            if (!parsedConfigs || parsedConfigs.length === 0) throw new Error("Configuration list is empty")

            const activeConfig = parsedConfigs[0]
            const refCount = activeConfig.references
            const targetEventId = eventData.Event?.Event?.ID

            if (!targetEventId) {
                throw new Error("Target event ID not found")
            }

            const contextRes = await fetch("/api/validation/context", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    eventId: targetEventId,
                    refCount: refCount
                }),
                signal
            })

            if (!contextRes.ok) {
                const errorData = await contextRes.json()
                throw new Error(errorData.error || "Failed to retrieve context")
            }

            const contextResult = await contextRes.json()
            contextDataResult = contextResult

            if (!contextResult.similarIds || contextResult.similarIds.length === 0) {
                throw new Error("No similar events found in vector database")
            }

            if (contextResult.similarIds.length < refCount) {
                console.warn(`Requested ${refCount} references but only found ${contextResult.similarIds.length}`)
            }

            setValidationSteps(prev => prev.map(s =>
                s.id === "context"
                    ? { ...s, status: "success", label: `Found ${contextResult.similarIds.length} references for the target event` }
                    : s
            ))

        } catch (error) {
            if (signal.aborted) return
            console.error(error)
            setValidationSteps(prev => prev.map(s =>
                s.id === "context"
                    ? { ...s, status: "error", error: error instanceof Error ? error.message : "Failed to retrieve context" }
                    : s
            ))
            return
        }

        // --- STEP 4: LLM Processing ---
        const MODULES = [
            "Event",
            "EventDates",
            "OwnerPOS",
            "FeeDefinitions",
            "Prices",
            "PriceGroups",
            "RightToSellAndFees"
        ];

        const step4: ValidationStep = {
            id: "llm",
            label: "Building prompts and sending them to LLM...",
            status: "loading",
            subSteps: MODULES.map(m => ({
                id: `llm-${m}`,
                label: m,
                status: "pending"
            }))
        }
        setValidationSteps(prev => [...prev, step4])

        if (!contextDataResult) {
            setValidationSteps(prev => prev.map(s => s.id === "llm" ? { ...s, status: "error", error: "Context data missing" } : s))
            return
        }

        try {
            let allIssues: ValidationIssue[] = [];
            let promptsLog: any = {};

            for (const module of MODULES) {
                if (signal.aborted) break
                setValidationSteps(prev => prev.map(s => {
                    if (s.id === "llm") {
                        return {
                            ...s,
                            subSteps: s.subSteps?.map(sub => sub.id === `llm-${module}` ? { ...sub, status: "loading" } : sub)
                        }
                    }
                    return s;
                }));

                try {
                    const llmRes = await fetch("/api/validation/llm", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            targetEvent: eventData,
                            referenceEvents: contextDataResult,
                            module: module,
                            systemMessage: systemMessage,
                            userPromptTemplate: userPrompt
                        }),
                        signal
                    })

                    if (!llmRes.ok) throw new Error(`Failed to validate ${module}`)
                    if (!llmRes.body) throw new Error("No response body")

                    const reader = llmRes.body.getReader()
                    const decoder = new TextDecoder()
                    let buffer = ""

                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break

                        buffer += decoder.decode(value, { stream: true })
                        const lines = buffer.split("\n")
                        buffer = lines.pop() || ""

                        for (const line of lines) {
                            if (!line.trim()) continue
                            try {
                                const msg = JSON.parse(line)

                                if (msg.type === "progress") {
                                    setValidationSteps(prev => prev.map(s => {
                                        if (s.id === "llm") {
                                            return {
                                                ...s,
                                                subSteps: s.subSteps?.map(sub =>
                                                    sub.id === `llm-${module}`
                                                        ? { ...sub, progress: { current: msg.current, total: msg.total } }
                                                        : sub
                                                )
                                            }
                                        }
                                        return s;
                                    }));
                                } else if (msg.type === "result") {
                                    if (msg.issues) {
                                        allIssues = [...allIssues, ...msg.issues];
                                    }
                                    if (msg.prompts) {
                                        promptsLog = { ...promptsLog, ...msg.prompts };
                                    }
                                }
                            } catch (e) {
                                console.error("Error parsing stream line", e)
                            }
                        }
                    }

                    setValidationSteps(prev => prev.map(s => {
                        if (s.id === "llm") {
                            return {
                                ...s,
                                subSteps: s.subSteps?.map(sub => sub.id === `llm-${module}` ? { ...sub, status: "success" } : sub)
                            }
                        }
                        return s;
                    }));

                } catch (moduleError) {
                    if (signal.aborted) throw moduleError // Re-throw to be caught by outer catch
                    console.error(`Error validating module ${module}:`, moduleError);
                    setValidationSteps(prev => prev.map(s => {
                        if (s.id === "llm") {
                            return {
                                ...s,
                                subSteps: s.subSteps?.map(sub => sub.id === `llm-${module}` ? { ...sub, status: "error", error: "Validation failed" } : sub)
                            }
                        }
                        return s;
                    }));
                }
            }

            console.log("--------------------------------------------------")
            console.log("GENERATED PROMPTS (CSV FORMAT):")
            console.log(promptsLog)
            console.log("--------------------------------------------------")
            console.log("LLM DETECTED ISSUES:")
            console.log(allIssues)
            console.log("--------------------------------------------------")

            const issueCount = allIssues.length;
            setValidationIssues(allIssues);

            setValidationSteps(prev => prev.map(s =>
                s.id === "llm"
                    ? { ...s, status: "success", label: `Analysis Complete. Found ${issueCount} issues`, subSteps: [] }
                    : s
            ))
            setIsValidationStarted(false)

            // --- SAVE TO OBSERVABILITY ---
            try {
                await fetch("/api/observability", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        eventId: eventData.Event?.Event?.ID || "unknown",
                        eventName: eventData.Event?.Event?.NameFr || "Unknown Event",
                        status: "success",
                        issues: allIssues,
                        prompts: promptsLog
                    })
                });
                console.log("Validation saved to history");
            } catch (saveError) {
                console.error("Failed to save validation history:", saveError);
            }

        } catch (error) {
            if (signal.aborted) {
                console.log("Validation cancelled by user")
                return
            }
            console.error(error)
            setValidationSteps(prev => prev.map(s =>
                s.id === "llm"
                    ? { ...s, status: "error", error: "LLM validation failed" }
                    : s
            ))
            setIsValidationStarted(false)
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
