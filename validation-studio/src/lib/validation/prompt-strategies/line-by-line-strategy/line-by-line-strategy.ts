import { Configuration } from "@/types/configuration";
import { PromptBuildingStrategy } from "../types";
import { BuiltPrompt, BuildPromptsOptions } from "../../shared-prompt-pipeline";

import { DataPreparation } from "@/lib/validation/orchestrator-modules/data-preparation";
import { PromptProcessor } from "@/lib/validation/orchestrator-modules/prompt-processor";
import { renderPrompt } from "@/lib/validation/prompt-builder";
import { getEventContributionForModule } from "@/lib/validation/module-contribution";
import { formatDataItemToCsv } from "@/lib/validation/format_csv_comparison";
import { DataItem } from "@/types/validation";
import { RuleProcessor } from "@/lib/validation/rule-processor";

export class LineByLinePromptStrategy implements PromptBuildingStrategy {
    buildPrompts(
        targetEvent: any,
        references: any[],
        module: string,
        config: Configuration,
        perturbationConfig: any | undefined,
        options: BuildPromptsOptions
    ): BuiltPrompt[] {
        const { joinListModules = false, skipSlicing = false, userPromptTemplate, renderOptions = {} } = options;

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

        if (dataItems.length === 0) {
            return [];
        }

        // Apply rules to data items BEFORE perturbation/slicing
        dataItems = RuleProcessor.applyRules(dataItems);

        // Apply perturbation + slicing on structured data.
        // If skipSlicing is true, the PromptProcessor will bypass chunking. We do this for UI reconstruction
        // to render the PARENT prompt (module data before slicing) instead of the individual sliced CHILD prompts.
        const processedItems = PromptProcessor.processItems(dataItems, module, config, perturbationConfig, skipSlicing);

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
}
