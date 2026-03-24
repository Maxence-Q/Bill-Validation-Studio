import { DataItem } from "@/types/validation";
import { Configuration } from "@/types/configuration";

/**
 * Input format for the slicing operation
 */
export interface SlicingInput {
    /** The list of data items to slice */
    items: DataItem[];
    /** The name of the module currently being processed (e.g., 'Event', 'OwnerPOS') */
    module: string;
    /** The slicing configuration from the user settings */
    slicingConfig: Configuration['slicing'];
}

export interface SlicingOutput {
    /** The chunked data items */
    chunks: DataItem[];
    /** The original index of the item that was sliced */
    parentIndex: number;
}

export class SlicingProcessor {
    /**
     * Slices the data items based on the provided configuration.
     * It splits large target records into multiple chunks (sub-prompts).
     */
    static slice(input: SlicingInput): DataItem[][] {
        const { items, module, slicingConfig } = input;

        // 1. Check if slicing is needed
        if (!slicingConfig || (slicingConfig.mode === 'global' && slicingConfig.globalValue === 100)) {
            return items.map(item => [item]);
        }

        // 2. Determine the slice percentage for this module
        let slicePercentage = 100;
        if (slicingConfig.mode === 'global') {
            slicePercentage = slicingConfig.globalValue || 100;
        } else {
            slicePercentage = slicingConfig.moduleValues?.[module] || slicingConfig.globalValue || 100;
        }

        // 3. Skip if percentage is 100%
        if (slicePercentage >= 100) {
            return items.map(item => [item]);
        }

        // 4. Apply chunking to each data item
        return items.map(item => {
            const allEntries = Object.entries(item.target);
            if (allEntries.length === 0) return [item];

            // Separate regular entries from POSPriceGroups entries
            const regularEntries = allEntries.filter(([k]) => !k.startsWith("POSPriceGroups."));
            const posPgEntries = allEntries.filter(([k]) => k.startsWith("POSPriceGroups."));

            const chunks: DataItem[] = [];

            // 4a. Handle Regular Entries
            if (regularEntries.length > 0) {
                // Calculate how many attributes per chunk
                const chunkSize = Math.max(1, Math.ceil(regularEntries.length * (slicePercentage / 100)));

                for (let i = 0; i < regularEntries.length; i += chunkSize) {
                    const slicedEntries = regularEntries.slice(i, i + chunkSize);
                    chunks.push({
                        ...item,
                        target: Object.fromEntries(slicedEntries)
                    });
                }
            }

            // 4b. Handle POSPriceGroups (Dedicated final chunk)
            if (posPgEntries.length > 0 || module === "RightToSellAndFees") {
                const posName = item.target["RO_PointOfSaleName"] || "";
                chunks.push({
                    ...item,
                    target: {
                        ...Object.fromEntries(posPgEntries),
                        "__is_summary_chunk": "true",
                        ...(posName ? { "RO_PointOfSaleName": posName } : {})
                    }
                });
            }

            // Fallback if somehow empty
            return chunks.length > 0 ? chunks : [item];
        });
    }
}
