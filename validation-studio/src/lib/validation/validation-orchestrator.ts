import { v4 as uuidv4 } from 'uuid';
import { Configuration } from "@/types/configuration";
import { LlmClient, RateLimitError } from "@/lib/validation/llm-client";
import { getTsApi } from "@/lib/api/bill-api";

// Pipeline Modules
import { RetrievalService } from "@/lib/validation/orchestrator-modules/retrieval-service";
import { MetricsCalculator, ValidationMetrics } from "@/lib/validation/orchestrator-modules/metrics-calculator";
import { ResultStorage } from "@/lib/validation/orchestrator-modules/result-storage";
import { loadPrompts, reconstructPrompts as reconstructPromptsService } from "@/lib/validation/orchestrator-modules/prompt-reconstruction-service";
import { buildPromptsForModule } from "@/lib/validation/shared-prompt-pipeline";

// Re-export for backward compatibility
export { reconstructPrompts } from "@/lib/validation/orchestrator-modules/prompt-reconstruction-service";

// Modules to process
export const VALIDATION_MODULES = [
    "Event",
    "OwnerPOS",
    "EventDates",
    "FeeDefinitions",
    "PriceGroups",
    "Prices",
    "RightToSellAndFees"
];

// --- Interface Definitions ---

export interface ValidationInput {
    targetEvent: any;
    config: Configuration;
    perturbationConfig?: any;
    onProgress?: (data: any) => void;
    storage?: {
        type: 'validation' | 'evaluation';
        path?: string;
        extraData?: any;
    }
    referenceEvents?: { similarIds: number[], events: any[] };
    moduleFilter?: string;
}

export interface ValidationOutput {
    issues: any[];
    prompts: Record<string, any>;
    metrics?: ValidationMetrics;
    /** Reasoning text per module. Each entry is an array with one string per logical
     *  item (sub-prompt reasonings are concatenated). Singleton modules like Event will
     *  always have a 1-element array; list modules like Prices will have N elements. */
    reasonings: Record<string, string[]>;
}

export interface RecordDetailsInput {
    targetEventId: number;
    referenceIds: number[];
    module?: string;
    config?: Configuration;
    perturbationConfig?: any;
}

// --- Helper: Fetch events for a list of IDs (API compartment) ---

async function fetchEventsForIds(ids: number[]): Promise<{ id: number, data: any }[]> {
    const fetchPromises = ids.map(async (id) => {
        const data = await getTsApi(id);
        return data ? { id, data } : null;
    });
    return (await Promise.all(fetchPromises)).filter(r => r !== null) as { id: number, data: any }[];
}

// --- Helper: Build Record (Core Logic) ---

function buildValidationRecord(
    input: ValidationInput,
    targetId: number,
    targetEvent: any,
    usedReferenceIds: number[],
    allIssues: any[],
    promptsDebug: Record<string, any>,
    metrics: ValidationMetrics | undefined,
    allPerturbationTracking: Record<string, any>,
    allReasonings: Record<string, string[]>
) {
    if (!input.storage) return null;

    const storageType = input.storage.type;
    return {
        id: storageType === 'validation' ? (input.storage.extraData?.id || uuidv4()) : uuidv4(),
        targetEventId: targetId,
        eventId: targetId,
        eventName: targetEvent.Event?.Event?.NameFr || targetEvent.Event?.Event?.NameEN || targetEvent.Event?.Event?.Name || "Unknown Event",
        timestamp: new Date().toISOString(),
        status: allIssues.length > 0 ? "success" : "failed",
        issuesCount: allIssues.length,
        config: input.config,
        issues: allIssues,
        referenceIds: usedReferenceIds,
        // We intentionally DO NOT store prompts in the history file to save space.
        // The UI will reconstruct them on the fly using targetEventId and referenceIds.
        prompts: undefined,
        reasonings: allReasonings,
        ...(storageType === 'evaluation' ? {
            perturbationConfig: input.perturbationConfig,
            perturbationTracking: allPerturbationTracking,
            metrics: metrics ? {
                precision: metrics.precision,
                recall: metrics.recall,
                tp: metrics.tp,
                fp: metrics.fp,
                fn: metrics.fn
            } : {},
            moduleMetrics: metrics?.moduleMetrics
        } : {})
    };
}

// --- Process 6.1: Main Validation / Evaluation ---

export async function validateEvent(input: ValidationInput): Promise<ValidationOutput> {
    const { targetEvent, config, perturbationConfig, onProgress } = input;
    if (!config) throw new Error("Configuration is missing");

    const allIssues: any[] = [];
    const promptsDebug: Record<string, any> = {};
    const allPerturbationTracking: Record<string, any> = {};
    /** Reasoning texts: one array per module, one string per logical item (sub-prompt reasonings concatenated). */
    const allReasonings: Record<string, string[]> = {};

    // 1. Retrieval (RAG → IDs only, then API → fetch events)
    const targetId = targetEvent?.Event?.Event?.ID;
    if (!targetId) throw new Error("Target event has no ID");

    let usedReferences: any[];
    let usedReferenceIds: number[];

    if (input.referenceEvents && input.referenceEvents.similarIds?.length > 0) {
        console.log("[Orchestrator] Using provided reference events.");
        const configRefsCount = config.references || 3;
        usedReferences = input.referenceEvents.events.slice(0, configRefsCount);
        usedReferenceIds = input.referenceEvents.similarIds.slice(0, configRefsCount);
    } else {
        // C5 — RAG
        const similarIds = await RetrievalService.retrieveContext(targetId, 4);
        const configRefsCount = config.references || 3;
        const idsToFetch = similarIds.slice(0, configRefsCount);

        // C1 — API
        const fetchedEvents = await fetchEventsForIds(idsToFetch);
        usedReferenceIds = fetchedEvents.map(r => r.id);
        usedReferences = fetchedEvents.map(r => r.data);
    }

    // Initialize LLM Client (C3)
    const llmClient = new LlmClient({
        apiKey: process.env.GROQ_API_PAID_KEY || process.env.GROQ_API_KEY,
        model: config.model || "openai/gpt-oss-20b",
        temperature: config.temperature || 0.0,
        reasoningEffort: config.reasoningEffort
    });

    // 2. Fetch Prompt Template
    const { systemMessage, userPromptTemplate } = loadPrompts();

    // 3. Process Modules - PASS 1: Generate all prompts
    // We do this to know the total global prompts and sub-prompts before starting execution
    const allBuiltPromptsByModule = new Map<string, any[]>();
    let globalTotalPrompts = 0;
    let globalTotalSubPrompts = 0;

    for (const module of VALIDATION_MODULES) {
        if (input.moduleFilter && input.moduleFilter !== module) continue;

        // C2 — Build Prompts
        const builtPrompts = buildPromptsForModule(targetEvent, usedReferences, module, config, perturbationConfig, {
            joinListModules: false,
            userPromptTemplate,
            renderOptions: {
                policyIntro: "",
                targetId: targetId.toString(),
                referenceIds: usedReferenceIds.join(", "),
                strategy: perturbationConfig ? "Perturbation Analysis" : "Similarity Search"
            }
        });

        allBuiltPromptsByModule.set(module, builtPrompts);

        // Track Perturbations
        // DEDUPLICATION: Only track perturbations for the *first* slice of a parent item.
        const seenParentIndices = new Set<number>();
        const moduleTracking = builtPrompts
            .map((p) => {
                if (!p.perturbationTracking) return null;
                const pIdx = p.slicingMetadata.parentIndex;
                if (seenParentIndices.has(pIdx)) return null;
                seenParentIndices.add(pIdx);
                return { index: pIdx, ...p.perturbationTracking };
            })
            .filter(Boolean);

        if (moduleTracking.length > 0) {
            allPerturbationTracking[module] = moduleTracking;
        }

        // Store prompts grouped by parentIndex (pre-slicing for display) for debug
        const parentMap = new Map<number, string[]>();
        builtPrompts.forEach(p => {
            const arr = parentMap.get(p.slicingMetadata.parentIndex) || [];
            arr.push(p.content);
            parentMap.set(p.slicingMetadata.parentIndex, arr);
        });
        promptsDebug[module] = Array.from(parentMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([parentIndex, contents]) => {
                const combined = contents.map((c, i) => {
                    if (i === 0) return c;
                    const lines = c.split("\n");
                    return lines.slice(2).join("\n");
                }).filter(s => s.length > 0).join("\n");

                return {
                    content: combined,
                    parentIndex
                };
            });

        // Global stats calculation
        let moduleTotalParents = 0;
        if (builtPrompts.length > 0) {
            moduleTotalParents = builtPrompts.reduce((acc, p) => Math.max(acc, p.slicingMetadata.parentIndex + 1), 0);
        }
        globalTotalPrompts += moduleTotalParents;
        globalTotalSubPrompts += builtPrompts.length;
    }

    // 4. Process Modules - PASS 2: C3 — LLM Execution
    let globalCurrentPrompt = 0;
    let globalCompletedSubPrompts = 0;

    for (const module of VALIDATION_MODULES) {
        if (input.moduleFilter && input.moduleFilter !== module) continue;

        const builtPrompts = allBuiltPromptsByModule.get(module) || [];

        const parentProgress = new Map<number, number>();
        const reasoningByParent = new Map<number, string[]>();

        let totalParents = 0;
        if (builtPrompts.length > 0) {
            totalParents = builtPrompts.reduce((acc, p) => Math.max(acc, p.slicingMetadata.parentIndex + 1), 0);
        }

        for (let i = 0; i < builtPrompts.length; i++) {
            const prompt = builtPrompts[i];
            const meta = prompt.slicingMetadata;

            // Only notify progress when starting a NEW parent or if it's the first sub-prompt of a parent
            const currentCount = parentProgress.get(meta.parentIndex) || 0;
            if (currentCount === 0) {
                globalCurrentPrompt++;
                if (onProgress) onProgress({
                    module,
                    current: meta.parentIndex + 1,
                    total: totalParents,
                    status: 'running',
                    global: {
                        currentPrompt: globalCurrentPrompt,
                        totalPrompts: globalTotalPrompts,
                        completedSubPrompts: globalCompletedSubPrompts,
                        totalSubPrompts: globalTotalSubPrompts
                    }
                });
            }
            parentProgress.set(meta.parentIndex, currentCount + 1);

            try {
                const { issues, reasoning } = await llmClient.validateSection(
                    systemMessage,
                    prompt.rendered
                );

                if (issues) {
                    allIssues.push(...issues.map(issue => ({
                        ...issue,
                        module,
                        itemIndex: meta.parentIndex
                    })));
                }

                if (reasoning) {
                    const parts = reasoningByParent.get(meta.parentIndex) ?? [];
                    parts.push(reasoning);
                    reasoningByParent.set(meta.parentIndex, parts);
                }

            } catch (err: any) {
                if (err instanceof RateLimitError) {
                    allIssues.push({
                        severity: "error",
                        module: module,
                        path: "API_LIMIT_REACHED",
                        message: "Evaluation stopped early: LLM API rate limit reached."
                    });
                    break;
                }
                console.error(`LLM Error module ${module}:`, err.message || err);
            }

            // Increment tracking after sub-prompt finishes
            globalCompletedSubPrompts++;

            // We want to update progress smoothly for ETA calculations, so send an update 
            // after every subprompt finishes too, even if it's the same parent.
            if (onProgress) onProgress({
                module,
                current: meta.parentIndex + 1,
                total: totalParents,
                status: 'running',
                global: {
                    currentPrompt: globalCurrentPrompt,
                    totalPrompts: globalTotalPrompts,
                    completedSubPrompts: globalCompletedSubPrompts,
                    totalSubPrompts: globalTotalSubPrompts
                }
            });
        }

        const finalizedReasonings: string[] = [];
        for (let idx = 0; idx < totalParents; idx++) {
            const parts = reasoningByParent.get(idx) || [];
            finalizedReasonings.push(parts.join("\n\n"));
        }
        allReasonings[module] = finalizedReasonings;

        if (onProgress) {
            onProgress({
                module,
                current: totalParents,
                total: totalParents,
                status: 'completed',
                global: {
                    currentPrompt: globalCurrentPrompt,
                    totalPrompts: globalTotalPrompts,
                    completedSubPrompts: globalCompletedSubPrompts,
                    totalSubPrompts: globalTotalSubPrompts
                }
            });
        }
    }

    // 5. Metrics Calculation
    const metrics = MetricsCalculator.calculateMetrics(allIssues, allPerturbationTracking);

    // 6. C4 — Storage
    const record = buildValidationRecord(
        input,
        targetId,
        targetEvent,
        usedReferenceIds,
        allIssues,
        promptsDebug,
        metrics,
        allPerturbationTracking,
        allReasonings
    );

    if (record && input.storage) {
        ResultStorage.saveRecord(record, input.storage.type);
    }

    return {
        issues: allIssues,
        prompts: promptsDebug,
        metrics: metrics,
        reasonings: allReasonings
    };
}

// --- Process 6.2: Get Record Details (Reconstruction) ---

export async function getRecordDetails(input: RecordDetailsInput) {
    const { targetEventId, referenceIds, module, config, perturbationConfig } = input;

    // C1 — API: Fetch Data
    const targetEvent = await getTsApi(targetEventId);
    if (!targetEvent) throw new Error(`Failed to fetch target event ${targetEventId}`);

    const fetchedReferences = await fetchEventsForIds(referenceIds);
    const validReferences = fetchedReferences.map(r => r.data);

    // C2 — Build Prompts (Reconstruction)
    // We delegate to the prompt-reconstruction-service which now (Phase 2) takes pre-fetched events
    return reconstructPromptsService({
        targetEvent,
        referenceEvents: validReferences,
        targetEventId,
        referenceIds,
        module,
        config,
        perturbationConfig
    });
}
