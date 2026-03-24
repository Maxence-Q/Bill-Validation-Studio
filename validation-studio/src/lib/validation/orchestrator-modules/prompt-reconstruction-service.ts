import { Configuration } from "@/types/configuration";
import * as path from 'path';
import * as fs from 'fs';
import { buildPromptsForModule } from "@/lib/validation/shared-prompt-pipeline";

// Modules to process
import { resolveValidationModules } from "@/lib/validation/module-resolver";
import { pretreatData } from "@/lib/validation/data-pretreatment";

/**
 * Loads prompt templates from the prompts_en.md file.
 * Shared between validateEvent (orchestrator) and reconstructPrompts (this service).
 */
export function loadPrompts(builderStrategy?: string) {
    try {
        const { parsePromptFile } = require('@/lib/validation/prompt-builder');
        const filename = (builderStrategy === "semantic-chunking")
            ? 'prompts_en_semantic.md'
            : 'prompts_en.md';
        const templatePath = path.join(process.cwd(), 'artefacts', filename);
        const templateContent = fs.readFileSync(templatePath, 'utf-8');

        const generalDescPath = path.join(process.cwd(), 'artefacts', 'general_description.md');
        const generalDescription = fs.existsSync(generalDescPath) ? fs.readFileSync(generalDescPath, 'utf-8') : "";

        // Organisation logic placeholder
        const organisation = "";

        return {
            ...parsePromptFile(templateContent),
            generalDescription,
            organisation
        };
    } catch (e) {
        console.error("Failed to load prompt template", e);
        return { systemMessage: "", userPromptTemplate: "", generalDescription: "", organisation: "" };
    }
}

/**
 * Reconstructs the prompts that were (or would be) sent to the LLM for a given event.
 * Used by the UI to display the exact prompt content for debugging/inspection.
 * 
 * Pure data transformation — receives pre-fetched events, no I/O.
 * The caller (API route or Orchestrator) is responsible for fetching events via the API compartment.
 * 
 * Uses the shared prompt pipeline with joinListModules=true so list-type modules
 * produce a single joined prompt for the "full view" UI display.
 */
export async function reconstructPrompts(input: {
    targetEvent: any;
    referenceEvents: any[];
    targetEventId: number;
    referenceIds: number[];
    module?: string;
    config?: Configuration;
    perturbationConfig?: any;
}) {
    let { targetEvent, referenceEvents } = input;
    const { targetEventId, referenceIds, module, config, perturbationConfig } = input;

    // 0. Pretreatment (e.g., semantic chunking)
    if (config) {
        const pretreated = pretreatData(targetEvent, referenceEvents, config);
        targetEvent = pretreated.targetEvent;
        referenceEvents = pretreated.usedReferences;
    }

    // 1. Load Template
    const { userPromptTemplate, generalDescription, organisation } = loadPrompts(config?.builderStrategy);

    // 2. Process Modules via shared pipeline
    const modulesToProcess = module ? [module] : resolveValidationModules(config || {} as Configuration, targetEvent);
    const reconstructedPrompts: Record<string, any[]> = {};

    for (const mod of modulesToProcess) {
        const builtPrompts = buildPromptsForModule(
            targetEvent,
            referenceEvents,
            mod,
            config || {} as Configuration,
            perturbationConfig,
            {
                joinListModules: false, // Keep list items (like Prices) separated by default

                // CRITICAL: We want to reconstruct the PARENT prompts (module data BEFORE slicing).
                // Example: We want exactly 17 parent prompts total for semantic chunking, 
                // not the 19 post-slicing child prompts actually sent to the LLM.
                skipSlicing: true,

                userPromptTemplate,
                renderOptions: {
                    elementName: mod,
                    targetId: targetEventId.toString(),
                    referenceIds: referenceIds.join(", "),
                    strategy: "Reconstruction",
                    generalDescription,
                    organisation
                }
            }
        );

        // Group by parentIndex for parent-level display
        const parentMap = new Map<number, string[]>();
        builtPrompts.forEach(p => {
            const arr = parentMap.get(p.slicingMetadata.parentIndex) || [];
            arr.push(p.rendered);
            parentMap.set(p.slicingMetadata.parentIndex, arr);
        });

        reconstructedPrompts[mod] = Array.from(parentMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([parentIndex, contents]) => {
                // If there are multiple chunks for one parent (should not happen now but kept for safety),
                // join them via divider.
                return {
                    content: contents.join("\n\n" + "=".repeat(50) + "\n\n"),
                    parentIndex
                };
            });
    }

    return reconstructedPrompts;
}
