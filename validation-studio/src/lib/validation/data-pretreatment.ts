import { Configuration } from "@/types/configuration";
import { transformReservatechEvent } from "./prompt-strategies/semantic-chunking";
import { resolveIds } from "./prompt-strategies/line-by-line-strategy/id-resolver";

export interface PretreatmentResult {
    targetEvent: any;
    usedReferences: any[];
}

/**
 * Handles data pretreatment before prompt generation, based on the selected builder strategy.
 * This encapsulates the preprocessing logic so the orchestrator remains clean.
 */
export function pretreatData(
    targetEvent: any,
    usedReferences: any[],
    config: Configuration
): PretreatmentResult {
    // 2. Semantic Chunking Pretreatment
    if (config.builderStrategy === "semantic-chunking") {
        return {
            targetEvent: transformReservatechEvent(targetEvent),
            usedReferences: usedReferences.map(ref => transformReservatechEvent(ref))
        };
    }

    // 3. Line-by-Line ID Resolving Pretreatment
    if (config.builderStrategy === "line-by-line") {
        return {
            targetEvent: resolveIds(targetEvent),
            usedReferences: usedReferences.map(ref => resolveIds(ref))
        };
    }

    // Default: No pretreatment required
    return {
        targetEvent,
        usedReferences
    };
}
