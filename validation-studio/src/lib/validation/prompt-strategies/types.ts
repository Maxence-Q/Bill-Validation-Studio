import { Configuration } from "@/types/configuration";
import { BuiltPrompt, BuildPromptsOptions } from "../shared-prompt-pipeline";

export interface PromptBuildingStrategy {
    buildPrompts(
        targetEvent: any,
        references: any[],
        module: string,
        config: Configuration,
        perturbationConfig: any | undefined,
        options: BuildPromptsOptions
    ): BuiltPrompt[];
}
