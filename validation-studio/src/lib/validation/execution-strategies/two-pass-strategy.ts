import { BuiltPrompt } from "../shared-prompt-pipeline";
import { ExecutionContext, ValidationExecutionStrategy } from "./types";
import { SinglePassStrategy } from "./single-pass-strategy";

export class TwoPassStrategy implements ValidationExecutionStrategy {
    private singlePassStrategy = new SinglePassStrategy();

    async execute(
        prompts: BuiltPrompt[],
        context: ExecutionContext
    ): Promise<{ issues: any[]; reasonings: string[] }> {
        const { targetEvent, module } = context;

        // --- PASS 1: Detection (High Recall) ---
        // We reuse the single pass logic to execute the chunked prompts and find all structural anomalies.
        const pass1Result = await this.singlePassStrategy.execute(prompts, context);

        if (pass1Result.issues.length === 0) {
            // No issues detected in Pass 1. Early exit to save LLM calls and latency.
            return pass1Result;
        }

        // --- PASS 2: Contextual Review (High Precision) ---
        // If issues exist, we collect broader context and ask the LLM to filter false positives.

        // 1. Gather Event Context Summary
        const eventSummary = this.buildEventContextSummary(targetEvent);

        // 2. Build the Pass 2 Review Prompt
        const pass2Prompt = this.buildPass2Prompt(pass1Result.issues, eventSummary, module);

        // 3. Execute Pass 2
        try {
            // We use the same system message or a specialized one if needed.
            const systemMessagePass2 = "You are a senior data evaluation agent. Your job is to review a list of potential data anomalies and filter out 'false positives' based on additional business context.";

            const pass2Response = await context.llmClient.validateSection(
                systemMessagePass2,
                pass2Prompt
            );

            // The LLM should return the filtered list of issues
            const filteredIssues = pass2Response.issues || [];

            // Append Pass 2 reasoning to the existing reasoning
            const combinedReasoning = [...pass1Result.reasonings];
            if (pass2Response.reasoning) {
                combinedReasoning.push(`[PASS 2 CONTEXTUAL REVIEW]\n${pass2Response.reasoning}`);
            }

            return {
                issues: filteredIssues.map((issue: any) => ({
                    ...issue,
                    module,
                    // Map back to itemIndex if possible, or leave undefined if it summarizes multiple items
                })),
                reasonings: combinedReasoning
            };

        } catch (err: any) {
            console.error(`LLM Error module ${module} (PASS 2):`, err.message || err);
            // Fallback: If Pass 2 fails, return Pass 1 results so we don't lose the raw flags
            return pass1Result;
        }
    }

    private buildEventContextSummary(targetEvent: any): string {
        // Extract key contextual fields that might explain operational workarounds
        const eventData = targetEvent?.Event?.Event || {};

        const summaryParts = [
            `Event Name: ${eventData.NameEN || eventData.NameFr || 'Unknown'}`,
            `Event Type: ${eventData.EventTypeName || 'Unknown'}`,
            `Event State: ${eventData.EventStateName || 'Unknown'}`,
        ];

        // Specific Dates context (Crucial for the 2038 dummy date workaround)
        if (targetEvent?.EventDates?.EventDates?.length > 0) {
            const firstDate = targetEvent.EventDates.EventDates[0];
            summaryParts.push(`Sales Start Date: ${firstDate.RO_SalesStartDateBoxOffice_Local || 'Not Set'}`);
            summaryParts.push(`Event Date: ${firstDate.RO_Date_Local || 'Not Set'}`);
        }

        return summaryParts.join("\n");
    }

    private buildPass2Prompt(issues: any[], eventSummary: string, module: string): string {
        const issuesStr = JSON.stringify(issues, null, 2);

        return `
I have run a strict, line-by-line structural validation on the data for module "${module}". 
It flagged the following potential anomalies:

### Detected Anomalies (Pass 1)
\`\`\`json
${issuesStr}
\`\`\`

Here is the broader context for this Event to help you determine if any of these are false positives caused by standard operational workarounds:

### Event Context Summary
${eventSummary}

### Task
Analyze the detected anomalies against the Event Context Summary.
Are any of these anomalies actually legitimate business workarounds (e.g., a dummy date far in the future like '2038' while the SalesStartDate is perfectly normal)?

Return ONLY the issues that are TRUE ERRORS. Filter out any false positives.
If all anomalies are false positives, return an empty array for \`issues\`.
Justify your filtering decisions in the \`reasoning\` field.
`;
    }
}
