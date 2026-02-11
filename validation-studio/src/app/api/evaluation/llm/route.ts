import { NextRequest, NextResponse } from "next/server";
import { LlmClient } from "@/lib/validation/llm-client";

/**
 * Simple evaluation LLM endpoint.
 * Accepts a ready-to-use prompt string (which already contains system + user messages),
 * sends it to the LLM, and returns the raw issues output.
 * 
 * Body: { prompt: string }
 * Response: { issues: Array<{ path, severity, message, suggestion? }> }
 */

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
        const { prompt } = body;

        if (!prompt || typeof prompt !== "string") {
            return NextResponse.json({ error: "Missing or invalid 'prompt' field" }, { status: 400 });
        }

        // Parse the prompt - it contains "=== SYSTEM MESSAGE ===" and "=== USER MESSAGE ===" sections
        const systemMarker = "=== SYSTEM MESSAGE ===";
        const userMarker = "=== USER MESSAGE ===";

        let systemMessage = "";
        let userMessage = "";

        const systemIdx = prompt.indexOf(systemMarker);
        const userIdx = prompt.indexOf(userMarker);

        if (systemIdx !== -1 && userIdx !== -1) {
            systemMessage = prompt.substring(systemIdx + systemMarker.length, userIdx).trim();
            userMessage = prompt.substring(userIdx + userMarker.length).trim();
        } else {
            // Fallback: treat entire prompt as user message
            userMessage = prompt;
        }

        // Initialize LLM Client
        const llmClient = new LlmClient({
            apiKey: process.env.GROQ_API_PAID_KEY || process.env.GROQ_API_KEY,
            model: "openai/gpt-oss-20b",
            temperature: 0.0
        });

        const issues = await llmClient.validateSection(
            systemMessage,
            userMessage,
            [TOOL_REPORT_STEP_ISSUES]
        );

        return NextResponse.json({ issues: issues || [] });

    } catch (error: any) {
        console.error("[Evaluation LLM] Error:", error);

        // Handle rate limit
        if (error?.status === 429 || error?.code === "rate_limit_exceeded") {
            return NextResponse.json(
                { error: "Rate limit reached", issues: [] },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: "LLM call failed", issues: [] },
            { status: 500 }
        );
    }
}
