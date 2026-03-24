import { Configuration } from "@/types/configuration";

/**
 * Returns the top-level keys (modules) of the JSON data.
 */
export function resolveValidationModules(config: Configuration, data?: any): string[] {
    if (!data || typeof data !== 'object') {
        return [];
    }

    // Return all top-level keys, filtering out system keys like _metadata
    return Object.keys(data).filter(key => key !== "_metadata");
}
