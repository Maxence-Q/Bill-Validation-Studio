import { Configuration } from "@/types/configuration";
import { DataPreparation } from "@/lib/validation/orchestrator-modules/data-preparation";
import { PromptProcessor, ProcessedItem } from "@/lib/validation/orchestrator-modules/prompt-processor";
import { renderPrompt, RenderPromptOptions } from "@/lib/validation/prompt-builder";
import { getEventContributionForModule } from "@/lib/validation/module-contribution";
import { formatCsvComparison, formatDataItemToCsv } from "@/lib/validation/format_csv_comparison";
import { DataItem } from "@/types/validation";
import { RuleProcessor } from "@/lib/validation/rule-processor";

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
    /** Template options for renderPrompt() */
    renderOptions?: RenderPromptOptions;
    /** The user prompt template string (from prompts_en.md) */
    userPromptTemplate: string;
}

/**
 * Unified prompt-building pipeline used by both validateEvent() and reconstructPrompts().
 * 
 * Pipeline: DataPreparation → PromptProcessor (perturbation + slicing) → Formatter → renderPrompt()
 */
export function buildPromptsForModule(
    targetEvent: any,
    references: any[],
    module: string,
    config: Configuration,
    perturbationConfig: any | undefined,
    options: BuildPromptsOptions
): BuiltPrompt[] {
    const { joinListModules = false, userPromptTemplate, renderOptions = {} } = options;

    let dataItems: DataItem[];

    if (joinListModules) {
        // Reconstruction mode: for list-type modules, join all items into one prompt
        const rawItems = DataPreparation.prepareModuleData(targetEvent, references, module);
        if (rawItems.length > 1) {
            // List-type module — join into a single prompt for display
            // We use legacy formatCsvComparison for this specific join logic for now
            const targetContribution = getEventContributionForModule(module, targetEvent);
            const refContributions = references.map((ref: any) => getEventContributionForModule(module, ref));
            const targetStr = Array.isArray(targetContribution) ? targetContribution.join("\n") : targetContribution;
            const flatRefs = refContributions.flat();

            // Convert legacy joined string back to a single DataItem for the pipeline
            const parse = (s: string) => {
                const dict: Record<string, string> = {};
                s.split("\n").forEach(l => {
                    if (l.includes(":")) {
                        const [k, ...v] = l.split(":");
                        dict[k.trim()] = v.join(":").trim();
                    }
                });
                return dict;
            };

            dataItems = [{
                target: parse(targetStr),
                references: [parse(flatRefs.join("\n"))] // Simplified single ref for join mode
            }];
        } else {
            dataItems = rawItems;
        }
    } else {
        // LLM mode: each list item gets its own prompt
        dataItems = DataPreparation.prepareModuleData(targetEvent, references, module);
    }

    // Apply rules to data items BEFORE perturbation/slicing
    dataItems = RuleProcessor.applyRules(dataItems);

    // Apply perturbation + slicing on structured data
    const processedItems = PromptProcessor.processItems(dataItems, module, config, perturbationConfig);

    // Render each item with the template after formatting to CSV
    return processedItems.map((item, i) => {
        const tableContent = formatDataItemToCsv(item.data);

        // Append sub-prompt info to label if needed
        const subLabel = item.metadata.totalSub > 1
            ? ` (Part ${item.metadata.subIndex + 1}/${item.metadata.totalSub})`
            : "";

        const rendered = renderPrompt(tableContent, userPromptTemplate, {
            ...renderOptions,
            elementName: renderOptions.elementName
                ? `${renderOptions.elementName}${subLabel}`
                : `${module} Validation - Item ${item.metadata.parentIndex + 1}${subLabel}`,
        });

        return {
            content: tableContent,
            rendered,
            perturbationTracking: item.perturbationTracking,
            slicingMetadata: item.metadata
        };
    });
}
