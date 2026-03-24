import { PerturbationEngine } from "@/lib/validation/perturbation-engine";
import { Configuration } from "@/types/configuration";
import { SlicingProcessor } from "./slicing-processor";
import { DataItem } from "@/types/validation";

export interface ProcessedItem {
    data: DataItem;
    perturbationTracking?: any;
    /** Metadata for sliced items */
    metadata: {
        parentIndex: number;
        subIndex: number;
        totalSub: number;
    };
}

export class PromptProcessor {
    /**
     * Entry point for processing module data. 
     * Applies perturbations and slicing (chunking) directly on the structured data items.
     * @param skipSlicing If true, slicing (chunking) is skipped (used for UI reconstruction).
     */
    static processItems(items: DataItem[], module: string, config: Configuration, perturbationConfig?: any, skipSlicing: boolean = false): ProcessedItem[] {
        // 1. Initial mapping to preserve original indices
        let currentItems = items.map((item, idx) => ({
            data: item,
            parentIndex: idx
        }));

        // 2. Apply Perturbations on the data itself
        let perturbedItems = currentItems;
        const perturbationTrackers = new Map<number, any>();

        if (perturbationConfig) {
            const engine = new PerturbationEngine();
            perturbedItems = currentItems.map(item => {
                const result = engine.perturbDataItem(item.data, perturbationConfig);
                perturbationTrackers.set(item.parentIndex, result.perturbationTracking);
                return {
                    ...item,
                    data: result.item
                };
            });
        }

        // 3. Apply Slicing (Chunking) on the data attributes
        const chunkedDataGroups = skipSlicing
            ? perturbedItems.map(pi => [pi.data])
            : SlicingProcessor.slice({
                items: perturbedItems.map(pi => pi.data),
                module,
                slicingConfig: config.slicing
            });

        // 4. Flatten chunks and assign sub-metadata
        const finalProcessed: ProcessedItem[] = [];

        chunkedDataGroups.forEach((chunks, parentIdx) => {
            chunks.forEach((chunk, subIndex) => {
                finalProcessed.push({
                    data: chunk,
                    perturbationTracking: perturbationTrackers.get(parentIdx),
                    metadata: {
                        parentIndex: parentIdx,
                        subIndex: subIndex,
                        totalSub: chunks.length
                    }
                });
            });
        });

        return finalProcessed;
    }
}
