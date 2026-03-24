import { BuiltPrompt } from "../shared-prompt-pipeline";
import { ExecutionContext, ValidationExecutionStrategy } from "./types";
import { RateLimitError } from "../llm-client";

export class SinglePassStrategy implements ValidationExecutionStrategy {
    async execute(
        prompts: BuiltPrompt[],
        context: ExecutionContext
    ): Promise<{ issues: any[]; reasonings: string[] }> {
        const { module, llmClient, systemMessage, onProgress, globalTracking } = context;

        const allIssues: any[] = [];
        const reasoningByParent = new Map<number, string[]>();

        let totalParents = 0;
        if (prompts.length > 0) {
            totalParents = prompts.reduce((acc, p) => Math.max(acc, p.slicingMetadata.parentIndex + 1), 0);
        }

        const parentProgress = new Map<number, number>();

        for (let i = 0; i < prompts.length; i++) {
            const prompt = prompts[i];
            const meta = prompt.slicingMetadata;

            // Progress tracking - start of new parent or first sub-prompt
            const currentCount = parentProgress.get(meta.parentIndex) || 0;
            if (currentCount === 0) {
                globalTracking.currentPrompt++;
                if (onProgress) {
                    onProgress({
                        module,
                        current: meta.parentIndex + 1,
                        total: totalParents,
                        status: 'running',
                        global: globalTracking
                    });
                }
            }
            parentProgress.set(meta.parentIndex, currentCount + 1);

            try {
                const { issues, reasoning } = await llmClient.validateSection(
                    systemMessage,
                    prompt.rendered
                );

                if (issues) {
                    allIssues.push(...issues.map(issue => ({
                        ...issue,
                        module,
                        itemIndex: meta.parentIndex
                    })));
                }

                if (reasoning) {
                    const parts = reasoningByParent.get(meta.parentIndex) ?? [];
                    parts.push(reasoning);
                    reasoningByParent.set(meta.parentIndex, parts);
                }

            } catch (err: any) {
                if (err instanceof RateLimitError) {
                    allIssues.push({
                        severity: "error",
                        module: module,
                        path: "API_LIMIT_REACHED",
                        message: "Evaluation stopped early: LLM API rate limit reached."
                    });
                    break;
                }
                console.error(`LLM Error module ${module}:`, err.message || err);
            }

            // Increment tracking after sub-prompt finishes
            globalTracking.completedSubPrompts++;

            // Smooth progress update after sub-prompt finishes
            if (onProgress) {
                onProgress({
                    module,
                    current: meta.parentIndex + 1,
                    total: totalParents,
                    status: 'running',
                    global: globalTracking
                });
            }
        }

        const finalizedReasonings: string[] = [];
        for (let idx = 0; idx < totalParents; idx++) {
            const parts = reasoningByParent.get(idx) || [];
            finalizedReasonings.push(parts.join("\n\n"));
        }

        if (onProgress) {
            onProgress({
                module,
                current: totalParents,
                total: totalParents,
                status: 'completed',
                global: globalTracking
            });
        }

        return {
            issues: allIssues,
            reasonings: finalizedReasonings
        };
    }
}
