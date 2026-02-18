import { Configuration } from "@/types/configuration";
import * as path from 'path';
import * as fs from 'fs';
import { buildPromptsForModule } from "@/lib/validation/shared-prompt-pipeline";

// Modules to process (imported constant)
import { VALIDATION_MODULES } from "@/lib/validation/validation-orchestrator";

/**
 * Loads prompt templates from the prompts_en.md file.
 * Shared between validateEvent (orchestrator) and reconstructPrompts (this service).
 */
export function loadPrompts() {
    try {
        const { parsePromptFile } = require('@/lib/validation/prompt-builder');
        const templatePath = path.join(process.cwd(), 'artefacts', 'prompts_en.md');
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        return parsePromptFile(templateContent);
    } catch (e) {
        console.error("Failed to load prompts_en.md", e);
        return { systemMessage: "", userPromptTemplate: "" };
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
    const { targetEvent, referenceEvents, targetEventId, referenceIds, module, config, perturbationConfig } = input;

    // 1. Load Template
    const { userPromptTemplate } = loadPrompts();

    // 2. Process Modules via shared pipeline
    const modulesToProcess = module ? [module] : VALIDATION_MODULES;
    const reconstructedPrompts: Record<string, any[]> = {};

    for (const mod of modulesToProcess) {
        const builtPrompts = buildPromptsForModule(
            targetEvent,
            referenceEvents,
            mod,
            config || {} as Configuration,
            perturbationConfig,
            {
                joinListModules: false, // Granular for eval detail, UI will group if needed
                userPromptTemplate,
                renderOptions: {
                    elementName: mod,
                    targetId: targetEventId.toString(),
                    referenceIds: referenceIds.join(", "),
                    strategy: "Reconstruction"
                }
            }
        );

        reconstructedPrompts[mod] = builtPrompts;
    }

    return reconstructedPrompts;
}
