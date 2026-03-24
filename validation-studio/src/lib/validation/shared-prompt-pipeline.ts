import { Configuration } from "@/types/configuration";
import { RenderPromptOptions } from "@/lib/validation/prompt-builder";
import { LineByLinePromptStrategy } from "./prompt-strategies/line-by-line-strategy/line-by-line-strategy";
import { SemanticChunkingStrategy } from "./prompt-strategies/semantic-chunking/semantic-chunking-strategy";

export interface BuiltPrompt {
    /** The raw CSV/table content (before template rendering) */
    content: string;
    /** The fully rendered prompt (after template injection) */
    rendered: string;
    /** Perturbation tracking metadata (if perturbation was applied) */
    perturbationTracking?: any;
    /** Metadata for slicing (parent/sub prompt mapping) */
    slicingMetadata: {
        parentIndex: number;
        subIndex: number;
        totalSub: number;
    };
}

export interface BuildPromptsOptions {
    /** If true, list-type modules (Prices, PriceGroups, RightToSellAndFees) are joined into a single prompt.
     *  Used by reconstruction (UI display). When false, each list item gets its own prompt (used by LLM calls). */
    joinListModules?: boolean;
    /** 
     * If true, slicing (splitting data into chunks) is bypassed entirely.
     * This ensures we render the PARENT prompt (module data before slicing) instead of the CHILD prompts.
     * Used by reconstruction for the Observability UI so developers see the complete module data (e.g. 17 original prompts) rather than post-sliced chunks (e.g. 19 prompts).
     */
    skipSlicing?: boolean;
    /** Template options for renderPrompt() */
    renderOptions?: RenderPromptOptions;
    /** The user prompt template string (from prompts_en.md) */
    userPromptTemplate: string;
}

/**
 * Unified prompt-building pipeline used by both validateEvent() and reconstructPrompts().
 * Now acts as a Strategy Manager that delegates to specific prompt generation strategies.
 */
export function buildPromptsForModule(
    targetEvent: any,
    references: any[],
    module: string,
    config: Configuration,
    perturbationConfig: any | undefined,
    options: BuildPromptsOptions
): BuiltPrompt[] {
    // Determine which strategy to use
    let strategy;
    if (config.builderStrategy === "semantic-chunking") {
        strategy = new SemanticChunkingStrategy();
    } else {
        strategy = new LineByLinePromptStrategy();
    }

    return strategy.buildPrompts(targetEvent, references, module, config, perturbationConfig, options);
}
