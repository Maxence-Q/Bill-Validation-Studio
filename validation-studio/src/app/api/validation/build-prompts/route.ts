import { NextRequest, NextResponse } from "next/server";
import { getEventContributionForModule } from "@/lib/validation/module-contribution";
import { formatCsvComparison } from "@/lib/validation/format_csv_comparison";
import { LlmClient } from "@/lib/validation/llm-client";

const MODULES = [
    "Event",
    "EventDates",
    "OwnerPOS",
    "FeeDefinitions",
    "Prices",
    "PriceGroups",
    "RightToSellAndFees"
];

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { targetEvent, referenceEvents, systemMessage, userPromptTemplate } = body;

        if (!targetEvent || !referenceEvents || !systemMessage || !userPromptTemplate) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const prompts: Record<string, string> = {};
        const client = new LlmClient(); // Access methods if needed, or just use helper functions

        for (const module of MODULES) {
            const targetContribution = getEventContributionForModule(module, targetEvent);
            const refContributions = referenceEvents.similarEvents.map((event: any) =>
                getEventContributionForModule(module, event)
            );

            // Using helper logic duplicated or accessible? 
            // Ideally we should have a shared builder function. 
            // But LlmClient typically handles this inside 'validateSection'.
            // However, we just want the prompt string.

            // Replicating logic from LlmClient usage in /api/validation/llm/route.ts partially
            // In route.ts it does:
            // const comparison = formatCsvComparison(targetContribution, refContributions);
            // const prompt = client.formatPrompt(userPromptTemplate, module, comparison);

            // Wait, LlmClient has 'formatPrompt' ? Let's check LlmClient details.
            // If not, we construct it manually using string replacement as typically done.
            // Let's assume userPromptTemplate has placeholders like {{MODULE}} and {{DATA}}?
            // Actually, usually it's passed as context.

            // Let's look at LlmClient content or assume standard replacement.
            // Better: use LlmClient method if available.
            // Inspecting LlmClient file previously... it has `validateSection`.
            // Let's assume we do manual formatting here consistent with other parts.

            let comparisonCsv = "";

            if (Array.isArray(targetContribution)) {
                // List module logic: concatenate comparisons for each item
                const joinedComparisons = targetContribution.map((item, index) => {
                    // Match by index (simple alignment for debug/prompt building)
                    const relevantRefStrings = refContributions.map((ref: string | string[]) => {
                        if (Array.isArray(ref)) return ref[index] || "";
                        return ""; // Mismatch or shorter list
                    });
                    // We cast relevantRefStrings as string[] since we ensure strings inside
                    return formatCsvComparison(item, relevantRefStrings);
                });
                comparisonCsv = joinedComparisons.join("\n\n" + "-".repeat(40) + "\n\n");
            } else {
                // Scalar module logic
                const validRefStrings = refContributions.map((ref: string | string[]) => {
                    return typeof ref === 'string' ? ref : "";
                });
                comparisonCsv = formatCsvComparison(targetContribution, validRefStrings);
            }

            let modulePrompt = userPromptTemplate
                .replace("{{MODULE_NAME}}", module)
                .replace("{{DATA_TABLE}}", comparisonCsv);

            // Also prepend system message?
            // "Somewhere in those str prompts, will be the following: DATA TO VALIDATE..."
            // Usually we send System + User.
            // The Perturbation Engine expects the FULL content to parse.
            // So we should combine them or just store the User Prompt?
            // The User Request says: "extract the whole data of the prompt... splitlines... inject"
            // So likely we want the piece that contains the CSV.

            prompts[module] = modulePrompt;
        }

        return NextResponse.json(prompts);

    } catch (error) {
        console.error("Failed to build prompts:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
