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
            const entries = Object.entries(item.target);
            if (entries.length <= 1) return [item];

            // Calculate how many attributes per chunk
            // e.g. 10% on 100 entries = 10 entries per chunk -> 10 chunks total
            const chunkSize = Math.max(1, Math.ceil(entries.length * (slicePercentage / 100)));

            const chunks: DataItem[] = [];
            for (let i = 0; i < entries.length; i += chunkSize) {
                const slicedEntries = entries.slice(i, i + chunkSize);
                chunks.push({
                    ...item,
                    target: Object.fromEntries(slicedEntries)
                });
            }

            return chunks;
        });
    }
}
