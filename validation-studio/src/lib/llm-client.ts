import OpenAI from "openai";

// Default configuration (can be overridden by environment variables)
const DEFAULT_API_KEY = process.env.GROQ_API_PAID_KEY || "";
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";

export interface LlmConfig {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    temperature?: number;
}

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
        tools: any[]
    ): Promise<any[]> {
        try {
            const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
                { role: "system", content: systemMessage },
                { role: "user", content: userPrompt }
            ];

            let toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] | undefined;
            let retries = 1;

            while (retries >= 0) {
                try {
                    const response = await this.client.chat.completions.create({
                        model: this.model,
                        messages: messages,
                        temperature: this.temperature,
                        tools: tools as any[],
                        tool_choice: { type: "function", function: { name: "report_step_issues" } }
                    });

                    const choice = response.choices[0];
                    toolCalls = choice.message.tool_calls;

                    if (toolCalls && toolCalls.length > 0) {
                        break; // Success
                    }
                } catch (e) {
                    console.error(`LLM Attempt failed. Retries left: ${retries}`, e);
                }

                retries--;
                if (retries >= 0) {
                    console.log("Retrying LLM call...");
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay
                }
            }

            const issues: any[] = [];

            if (toolCalls) {
                for (const toolCall of toolCalls) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const tc = toolCall as any;
                    if (tc.function?.name === "report_step_issues") {
                        let args: any;
                        try {
                            args = JSON.parse(tc.function.arguments);
                        } catch (e) {
                            console.warn("JSON Parse failed, attempting correction with openai/gpt-oss-120b...", e);
                            try {
                                const correctionResponse = await this.client.chat.completions.create({
                                    model: "openai/gpt-oss-120b",
                                    messages: [
                                        { role: "system", content: "You are a JSON repair expert. Fix syntax errors. Output ONLY valid JSON." },
                                        { role: "user", content: `Fix this JSON issues list: ${tc.function.arguments}` }
                                    ],
                                    temperature: 0
                                });
                                const fixedContent = correctionResponse.choices[0].message.content || "";
                                const cleanJson = fixedContent.replace(/```json/g, "").replace(/```/g, "").trim();
                                args = JSON.parse(cleanJson);
                                console.log("JSON Correction successful.");
                            } catch (correctionError) {
                                console.error("JSON Correction failed:", correctionError);
                                continue; // Skip this tool call if correction fails
                            }
                        }

                        if (args && args.issues && Array.isArray(args.issues)) {
                            issues.push(...args.issues);
                        }
                    }
                }
            }

            return issues;

        } catch (error) {
            console.error("LLM API Call failed:", error);
            throw error;
        }
    }
}
