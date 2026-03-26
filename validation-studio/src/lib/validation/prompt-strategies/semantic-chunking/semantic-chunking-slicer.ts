import { DataItem } from "@/types/validation";

export class SemanticChunkingSlicer {
    /**
     * Slices the data items based on specific logical rules for Semantic Chunking.
     * 
     * - Event: Splits into two chunks (keys starting with "Event.", and the rest).
     * - EventDates: Splits into two chunks (keys containing ".Schedule.", and the rest).
     * - Prices: Splits into three chunks (keys containing "PriceGroup.", "MainPrice", and the rest).
     * - RightToSellAndFees: Splits into two chunks (keys containing "RightToSellFees[].", and the rest).
     */
    static sliceItem(item: DataItem, module: string): DataItem[] {
        const allEntries = Object.entries(item.target);
        if (allEntries.length === 0) return [item];

        // Metadata keys (like __module, __is_summary_chunk) should be preserved in all chunks
        const metadataEntries = allEntries.filter(([k]) => k.startsWith("__"));

        if (module === "Event") {
            const eventEntries = allEntries.filter(([k]) => k.startsWith("Event.") && !k.startsWith("__"));
            const restEntries = allEntries.filter(([k]) => !k.startsWith("Event.") && !k.startsWith("__"));

            const chunks: DataItem[] = [];
            if (eventEntries.length > 0) chunks.push({ ...item, target: { ...Object.fromEntries(eventEntries), ...Object.fromEntries(metadataEntries) } });
            if (restEntries.length > 0) chunks.push({ ...item, target: { ...Object.fromEntries(restEntries), ...Object.fromEntries(metadataEntries) } });

            return chunks.length > 0 ? chunks : [item];
        } else if (module === "EventDates") {
            const scheduleEntries = allEntries.filter(([k]) => k.includes(".Schedule.") && !k.startsWith("__"));
            const restEntries = allEntries.filter(([k]) => !k.includes(".Schedule.") && !k.startsWith("__"));

            const chunks: DataItem[] = [];
            if (scheduleEntries.length > 0) chunks.push({ ...item, target: { ...Object.fromEntries(scheduleEntries), ...Object.fromEntries(metadataEntries) } });
            if (restEntries.length > 0) chunks.push({ ...item, target: { ...Object.fromEntries(restEntries), ...Object.fromEntries(metadataEntries) } });

            return chunks.length > 0 ? chunks : [item];
        } else if (module === "Prices") {
            const priceGroupEntries = allEntries.filter(([k]) => k.includes("PriceGroup.") && !k.startsWith("__"));
            const mainPriceEntries = allEntries.filter(([k]) => k.includes("MainPrice") && !k.startsWith("__"));
            const restEntries = allEntries.filter(([k]) => !k.includes("PriceGroup.") && !k.includes("MainPrice") && !k.startsWith("__"));

            const chunks: DataItem[] = [];
            if (priceGroupEntries.length > 0) chunks.push({ ...item, target: { ...Object.fromEntries(priceGroupEntries), ...Object.fromEntries(metadataEntries) } });
            if (mainPriceEntries.length > 0) chunks.push({ ...item, target: { ...Object.fromEntries(mainPriceEntries), ...Object.fromEntries(metadataEntries) } });
            if (restEntries.length > 0) chunks.push({ ...item, target: { ...Object.fromEntries(restEntries), ...Object.fromEntries(metadataEntries) } });

            return chunks.length > 0 ? chunks : [item];
        } else if (module === "RightToSellAndFees") {
            const feeEntries = allEntries.filter(([k]) => k.includes("RightToSellFees[].") && !k.startsWith("__"));
            const restEntries = allEntries.filter(([k]) => !k.includes("RightToSellFees[].") && !k.startsWith("__"));

            const chunks: DataItem[] = [];
            if (feeEntries.length > 0) chunks.push({ ...item, target: { ...Object.fromEntries(feeEntries), ...Object.fromEntries(metadataEntries) } });
            if (restEntries.length > 0) chunks.push({ ...item, target: { ...Object.fromEntries(restEntries), ...Object.fromEntries(metadataEntries) } });

            return chunks.length > 0 ? chunks : [item];
        }

        return [item];
    }
}
