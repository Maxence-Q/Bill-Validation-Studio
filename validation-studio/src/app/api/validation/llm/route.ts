import { NextRequest, NextResponse } from "next/server";
import { getEventContributionForModule } from "@/lib/validation/module-contribution";
import { formatCsvComparison } from "@/lib/validation/format_csv_comparison";
import { LlmClient } from "@/lib/validation/llm-client";

// Modules to process
const MODULES = [
    "Event",
    "OwnerPOS",
    "EventDates",
    "FeeDefinitions",
    "PriceGroups",
    "Prices",
    "RightToSellAndFees"
];

// Helper for fuzzy matching (simple Levenshtein-like ratio)
function similarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) {
        return 1.0;
    }
    const costs = new Array();
    for (let i = 0; i <= shorter.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= longer.length; j++) {
            if (i == 0)
                costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0)
            costs[longer.length] = lastValue;
    }
    return (longer.length - costs[longer.length]) / parseFloat(longer.length.toString());
}

function extractSpecElementName(marker: string, targetElementStr: string): string | null {
    const startIndex = targetElementStr.indexOf(marker);
    if (startIndex === -1) return null;

    const endIndex = targetElementStr.indexOf("\n", startIndex);
    if (endIndex === -1) {
        return targetElementStr.substring(startIndex + marker.length).trim();
    }
    return targetElementStr.substring(startIndex + marker.length, endIndex).trim();
}

// --- CONSTANTS ---

const TOOL_REPORT_STEP_ISSUES = {
    type: "function",
    function: {
        name: "report_step_issues",
        description: "Reports the result of the verification analysis for the current step. Must be called even if no anomalies are found.",
        parameters: {
            type: "object",
            properties: {
                issues: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            path: { type: "string" },
                            severity: { type: "string", enum: ["error", "warning", "info"] },
                            message: { type: "string" },
                            suggestion: { type: "string" }
                        },
                        required: ["path", "severity", "message"]
                    }
                }
            },
            required: ["issues"]
        }
    }
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { targetEvent, referenceEvents, config, module: requestedModule, systemMessage, userPromptTemplate } = body;

        if (!targetEvent || !referenceEvents) {
            return NextResponse.json({ error: "Missing targetEvent or referenceEvents" }, { status: 400 });
        }

        // Filter modules if a specific one is requested
        const modulesToProcess = requestedModule
            ? MODULES.filter(m => m === requestedModule)
            : MODULES;

        if (modulesToProcess.length === 0) {
            return NextResponse.json({ error: "Invalid module requested" }, { status: 400 });
        }

        const refs = Array.isArray(referenceEvents.events) ? referenceEvents.events : [];

        // Initialize LLM Client
        const llmClient = new LlmClient({
            apiKey: process.env.GROQ_API_PAID_KEY || process.env.GROQ_API_KEY,
            model: config?.model || "openai/gpt-oss-20b",
            temperature: 0.0
        });

        // Pre-calculate contributions
        const refContributionsByModule: Record<string, any[]> = {};
        for (const module of modulesToProcess) {
            refContributionsByModule[module] = refs.map((ref: any) => getEventContributionForModule(module, ref));
        }

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                const send = (data: any) => controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));

                const allIssues: any[] = [];
                const promptsDebug: Record<string, any> = {};
                const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

                try {
                    // Process each module
                    moduleLoop: for (const module of modulesToProcess) {
                        const targetContribution = getEventContributionForModule(module, targetEvent);
                        let csvPrompts: string[] = [];

                        // Case 1: Simple Object
                        if (!Array.isArray(targetContribution)) {
                            const similarContributions = refContributionsByModule[module].map(c => (c as string) || "");
                            csvPrompts.push(formatCsvComparison(targetContribution as string, similarContributions));
                        }
                        // Case 2: Lists
                        else {
                            let marker = "";
                            if (module === "Prices") marker = "PriceGroup.PriceGroupNameFr: ";
                            else if (module === "PriceGroups") marker = "Name: ";
                            else if (module === "RightToSellAndFees") marker = "RO_PointOfSaleName: ";

                            (targetContribution as string[]).forEach((targetElementStr) => {
                                const similarStrs: string[] = [];
                                const targetName = extractSpecElementName(marker, targetElementStr);

                                // For each reference, find the best match
                                for (let i = 0; i < refs.length; i++) {
                                    let foundSimilarStr = "";
                                    const refList = refContributionsByModule[module][i] as string[];

                                    if (Array.isArray(refList) && refList.length > 0) {
                                        // 1. Exact Match
                                        if (targetName) {
                                            for (const simElementStr of refList) {
                                                if (extractSpecElementName(marker, simElementStr) === targetName) {
                                                    foundSimilarStr = simElementStr;
                                                    break;
                                                }
                                            }
                                        }

                                        // 2. Fuzzy Match (if no exact match found)
                                        if (!foundSimilarStr && targetName) {
                                            let bestMatch = "";
                                            let bestScore = 0.0;
                                            for (const simElementStr of refList) {
                                                const simName = extractSpecElementName(marker, simElementStr);
                                                if (simName) {
                                                    const score = similarity(targetName.toLowerCase(), simName.toLowerCase());
                                                    if (score > bestScore) {
                                                        bestScore = score;
                                                        bestMatch = simElementStr;
                                                    }
                                                }
                                            }
                                            if (bestMatch) foundSimilarStr = bestMatch;
                                        }
                                    }

                                    similarStrs.push(foundSimilarStr);
                                }

                                csvPrompts.push(formatCsvComparison(targetElementStr, similarStrs));
                            });
                        }

                        // Save prompts for debug
                        promptsDebug[module] = [];

                        // Send initial progress for this module (0/total)
                        send({ type: "progress", module, current: 0, total: csvPrompts.length });

                        console.log(`[LLM] Validating module: ${module} (${csvPrompts.length} prompts)`);

                        for (let i = 0; i < csvPrompts.length; i++) {
                            // Add a small delay to avoid rate limits
                            await delay(500);

                            const promptContent = csvPrompts[i];

                            const userPrompt = userPromptTemplate
                                .replace("{policy_intro}", "")
                                .replace("{element_name}", `${module} Validation - Item ${i + 1}`)
                                .replace("{cible_id}", targetEvent?.Event?.Event?.ID || "Unknown")
                                .replace("{similar_id}", refs.map((r: any) => r?.Event?.Event?.ID).join(", "))
                                .replace("{strategy_used}", "Similarity Search")
                                .replace("{comparison_data}", promptContent);

                            // Store full prompt for observability
                            const fullDebugText = `=== SYSTEM MESSAGE ===
${systemMessage}

=== USER MESSAGE ===
${userPrompt}`;
                            promptsDebug[module].push(fullDebugText);

                            try {
                                const issues = await llmClient.validateSection(
                                    systemMessage,
                                    userPrompt,
                                    [TOOL_REPORT_STEP_ISSUES]
                                );

                                if (issues && issues.length > 0) {
                                    const enrichedIssues = issues.map(issue => ({
                                        ...issue,
                                        module: module,
                                        itemIndex: i
                                    }));
                                    allIssues.push(...enrichedIssues);
                                }
                            } catch (err: any) {
                                console.error(`[LLM] Error validating ${module} item ${i}:`, err);

                                // Check for Rate Limit Error (429)
                                if (err?.status === 429 || err?.code === 'rate_limit_exceeded') {
                                    allIssues.push({
                                        severity: "error",
                                        module: module,
                                        path: "API_LIMIT_REACHED",
                                        message: "Evaluation stopped early: LLM API rate limit reached. Partial results returned."
                                    });
                                    break moduleLoop; // Stop everything
                                }

                                allIssues.push({
                                    severity: "error",
                                    path: module,
                                    message: `Validation failed for this section due to system error: ${err}`
                                });
                            }

                            // Send progress update
                            send({ type: "progress", module, current: i + 1, total: csvPrompts.length });
                        }
                    }

                    // Send final result
                    send({
                        type: "result",
                        message: "Validation complete",
                        issues: allIssues,
                        prompts: promptsDebug
                    });

                    controller.close();

                } catch (err) {
                    console.error("Stream processing error:", err);
                    send({ type: "error", message: "Internal stream processing error" });
                    controller.close();
                }
            }
        });

        return new NextResponse(stream, {
            headers: {
                "Content-Type": "application/x-ndjson",
                "Transfer-Encoding": "chunked"
            }
        });

    } catch (error) {
        console.error("LLM validation error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
