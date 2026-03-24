import { Configuration } from "@/types/configuration";
import { BuiltPrompt } from "../shared-prompt-pipeline";
import { LlmClient } from "../llm-client";

export interface ExecutionContext {
    targetEvent: any;
    references: any[];
    config: Configuration;
    llmClient: LlmClient;
    systemMessage: string;
    module: string;
    onProgress?: (data: any) => void;
    globalTracking: {
        currentPrompt: number;
        totalPrompts: number;
        completedSubPrompts: number;
        totalSubPrompts: number;
    };
}

export interface ValidationExecutionStrategy {
    execute(prompts: BuiltPrompt[], context: ExecutionContext): Promise<{
        issues: any[];
        reasonings: string[];
    }>;
}
