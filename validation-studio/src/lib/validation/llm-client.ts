import OpenAI from "openai";
import fs from "fs";
import path from "path";

// Default configuration (can be overridden by environment variables)
const DEFAULT_API_KEY = process.env.GROQ_API_PAID_KEY || "";
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";

/**
 * LLM Compartment (C3): Default tool schema for the report_step_issues tool call.
 * 
 * Exported so the Orchestrator or tests can reference it if needed,
 * but the LLM compartment uses it automatically when no tools are passed.
 */
export const DEFAULT_TOOL_SCHEMA = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "artefacts", "tools_en.json"), "utf8")
);

/**
 * Typed error for rate-limit responses (429 / rate_limit_exceeded).
 * Thrown by the LLM compartment so the Orchestrator can catch it cleanly.
 */
export class RateLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RateLimitError';
    }
}

export interface LlmConfig {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    temperature?: number;
}

/**
 * Result returned by validateSection.
 * - `issues`: parsed list of detected issues
 * - `reasoning`: raw reasoning text emitted by the model (empty string if the model
 *   does not support extended thinking / reasoning output)
 */
export interface LlmResult {
    issues: any[];
    reasoning: string;
}

/**
 * LLM Compartment (C3): Stateless LLM client.
 * 
 * Contract:
 *   Input:  { systemMessage, userPrompt, tools? }
 *   Output: LlmResult — { issues: Issue[], reasoning: string }
 * 
 * Handles retry logic, JSON correction, and rate-limit detection internally.
 */
export class LlmClient {
    private client: OpenAI;
    private model: string;
    private temperature: number;

    constructor(config: LlmConfig = {}) {
        this.client = new OpenAI({
            apiKey: config.apiKey || DEFAULT_API_KEY,
            baseURL: config.baseUrl || DEFAULT_BASE_URL,
        });
        this.model = config.model || "openai/gpt-oss-20b"; // Default Groq model
        this.temperature = config.temperature !== undefined ? config.temperature : 0.0;
    }

    async validateSection(
        systemMessage: string,
        userPrompt: string,
        tools: any[] = [DEFAULT_TOOL_SCHEMA]
    ): Promise<LlmResult> {
        try {
            const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                { role: "system", content: systemMessage },
                { role: "user", content: userPrompt }
            ];

            let toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] | undefined;
            let lastChoice: OpenAI.Chat.Completions.ChatCompletion.Choice | undefined;
            let retries = 2; // Increased retries
            let lastError: any = null;

            while (retries >= 0) {
                try {
                    // Use stronger model if we've already failed once (retries 2 -> 1)
                    const currentModel = retries < 2 ? "openai/gpt-oss-120b" : this.model;

                    const response = await this.client.chat.completions.create({
                        model: currentModel,
                        messages: messages,
                        temperature: this.temperature,
                        tools: tools as any[],
                        tool_choice: { type: "function", function: { name: DEFAULT_TOOL_SCHEMA.function.name } },
                        reasoning_effort: "medium" as any
                    });

                    const choice = response.choices[0];
                    lastChoice = choice;
                    toolCalls = choice.message.tool_calls;

                    if (toolCalls && toolCalls.length > 0) {
                        let allParsed = true;
                        for (const toolCall of toolCalls) {
                            if (toolCall.type !== 'function') continue;
                            const tc = toolCall;
                            try {
                                JSON.parse(tc.function.arguments);
                            } catch (e) {
                                console.warn(`JSON Parse failed on attempt ${3 - retries}. Attempting LLM repair...`);
                                try {
                                    tc.function.arguments = await this.repairJson(tc.function.arguments);
                                } catch (repairError) {
                                    // If even the repair LLM fails, we push the assistant message and an error for the next turn
                                    messages.push(choice.message);
                                    messages.push({
                                        role: "tool",
                                        tool_call_id: tc.id,
                                        content: `Error: Your tool arguments were not valid JSON. Please provide valid JSON. Details: ${repairError}`
                                    } as any);
                                    allParsed = false;
                                    break;
                                }
                            }
                        }
                        if (allParsed) break; // Success
                    } else {
                        console.warn(`LLM returned no tool calls on attempt ${3 - retries}`);
                        messages.push({
                            role: "user",
                            content: `Error: No tool call detected. You MUST use the '${DEFAULT_TOOL_SCHEMA.function.name}' tool.`
                        });
                    }
                } catch (e: any) {
                    lastError = e;
                    if (e?.status === 429 || e?.code === 'rate_limit_exceeded') {
                        throw new RateLimitError(e?.message || 'LLM API rate limit reached');
                    }

                    if (e?.status === 400 && e?.error?.message) {
                        const fullMsg = e.error.message;
                        const shortError = fullMsg.split('errors:')[1] || fullMsg;
                        console.warn(`LLM Tool Validation Failed (${retries} left): ${shortError.trim()}`);

                        messages.push({
                            role: "user",
                            content: `Correction: Tool call failed validation: ${shortError.trim()}. Fix 'severity' (error/warning/info) or other schema issues.`
                        });
                    } else {
                        console.error(`LLM Attempt failed (${retries} left):`, e.message || e);
                    }
                }

                retries--;
                if (retries >= 0) await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Extract reasoning from the last successful choice.
            // Models with extended thinking emit it as model_extra.reasoning (Groq)
            // or as reasoning_content (some other providers), or directly as reasoning.
            const rawMsg = lastChoice?.message as any;
            const reasoning: string =
                rawMsg?.reasoning ??
                rawMsg?.model_extra?.reasoning ??
                rawMsg?.reasoning_content ??
                "";

            const issues: any[] = [];
            if (toolCalls) {
                for (const toolCall of toolCalls) {
                    if (toolCall.type === 'function' && toolCall.function.name === DEFAULT_TOOL_SCHEMA.function.name) {
                        try {
                            const args = JSON.parse(toolCall.function.arguments);
                            if (args && args.issues) issues.push(...args.issues);
                        } catch (e) {
                            console.error("Critical: Failed parsing after retries", e);
                        }
                    }
                }
            } else if (lastError) {
                throw lastError;
            }

            return { issues, reasoning };

        } catch (error) {
            if (error instanceof RateLimitError) throw error;
            console.error("LLM API Call failed:", error);
            throw error;
        }
    }

    private async repairJson(malformed: string): Promise<string> {
        const correctionResponse = await this.client.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                { role: "system", content: "You are a JSON repair expert. Fix syntax errors. Output ONLY valid JSON." },
                { role: "user", content: `Fix this JSON issues list: ${malformed}` }
            ],
            temperature: 0
        });
        const fixedContent = correctionResponse.choices[0].message.content || "";
        const cleanJson = fixedContent.replace(/```json/g, "").replace(/```/g, "").trim();
        return cleanJson;
    }
}
