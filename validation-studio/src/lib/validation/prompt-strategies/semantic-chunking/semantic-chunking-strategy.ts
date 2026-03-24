import { Configuration } from "@/types/configuration";
import { PromptBuildingStrategy } from "../types";
import { BuiltPrompt, BuildPromptsOptions } from "../../shared-prompt-pipeline";

import { DataPreparation } from "@/lib/validation/orchestrator-modules/data-preparation";
import { PerturbationEngine } from "@/lib/validation/perturbation-engine";
import { renderPrompt } from "@/lib/validation/prompt-builder";
import { SemanticChunkingSlicer } from "./semantic-chunking-slicer";
import { getEventContributionForModule } from "@/lib/validation/module-contribution";
import { formatDataItemToCsv } from "@/lib/validation/format_csv_comparison";
import { DataItem } from "@/types/validation";

export class SemanticChunkingStrategy implements PromptBuildingStrategy {
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
                const targetContribution = getEventContributionForModule(module, targetEvent);
                const refContributions = references.map((ref: any) => getEventContributionForModule(module, ref));
                const targetStr = Array.isArray(targetContribution) ? targetContribution.join("\n") : targetContribution;
                const flatRefs = refContributions.flat();

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
                    references: [parse(flatRefs.join("\n"))]
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

        // Rules are skipped for this strategy as requested



        // Apply perturbation + custom slicing on structured data
        const engine = perturbationConfig ? new PerturbationEngine() : null;
        const processedItems: { data: DataItem; perturbationTracking?: any; metadata: any }[] = [];

        dataItems.forEach((item, parentIdx) => {
            let processedItemData = item;
            let tracking = undefined;

            // Apply perturbation first
            if (engine && perturbationConfig) {
                const result = engine.perturbDataItem(item, perturbationConfig);
                processedItemData = result.item;
                tracking = result.perturbationTracking;
            }
            // Inject module name for specific formatting rules (like ID filtering for Prices)
            processedItemData.target["__module"] = module;

            // Then apply custom slicing logic.
            // If skipSlicing is true (e.g., UI reconstruction), we bypass slicing to return the single PARENT prompt
            // instead of generating multiple CHILD prompts. This ensures the observability view correctly displays
            // the module data as it was BEFORE getting chopped up for LLM context limits.
            const chunks = (skipSlicing)
                ? [processedItemData]
                : SemanticChunkingSlicer.sliceItem(processedItemData, module);

            chunks.forEach((chunk, subIndex) => {
                processedItems.push({
                    data: chunk,
                    perturbationTracking: tracking,
                    metadata: {
                        parentIndex: parentIdx,
                        subIndex: subIndex,
                        totalSub: chunks.length
                    }
                });
            });
        });

        // Render each item with the template after formatting to CSV
        return processedItems.map((item, i) => {
            const tableContent = formatDataItemToCsv(item.data);

            const subLabel = item.metadata.totalSub > 1
                ? ` (Part ${item.metadata.subIndex + 1}/${item.metadata.totalSub})`
                : "";

            const rendered = renderPrompt(tableContent, userPromptTemplate, {
                ...renderOptions,
                elementName: renderOptions.elementName
                    ? `${renderOptions.elementName}${subLabel}`
                    : `${module} Validation - Item ${item.metadata.parentIndex + 1}${subLabel}`,
                strategy: "Semantic Chunking"
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
