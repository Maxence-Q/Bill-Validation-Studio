export interface RenderPromptOptions {
    policyIntro?: string;
    elementName?: string;
    targetId?: string;
    referenceIds?: string;
    strategy?: string;
}

/**
 * Parses the raw prompt file content (e.g., prompts_en.md) to extract System Message and User Prompt Template.
 * @param content The raw string content of the prompt file.
 * @returns An object containing the systemMessage and userPromptTemplate.
 */
export function parsePromptFile(content: string): { systemMessage: string, userPromptTemplate: string } {
    if (!content) return { systemMessage: "", userPromptTemplate: "" };

    const systemMessage = content.split("SYSTEM_MESSAGE =")[1]?.split("USER_PROMPT =")[0]?.trim() || "";
    const rawUserPrompt = content.split("USER_PROMPT =")[1]?.trim() || "";

    // Remove the python-style triple quotes if present at the end
    const userPromptTemplate = rawUserPrompt.replace(/"""\.strip\(\)$/, "").trim();

    return { systemMessage, userPromptTemplate };
}

/**
 * Renders the full validation prompt by injecting data into the provided template.
 * @param comparisonData The CSV/Table data string to inject.
 * @param template The User Prompt Template string to use.
 * @param options Optional metadata to inject (defaults to placeholders if missing).
 * @returns The fully constructed prompt string.
 */
export function renderPrompt(comparisonData: string, template: string, options: RenderPromptOptions = {}): string {
    const {
        policyIntro = "",
        elementName = "Unknown Element",
        targetId = "Unknown",
        referenceIds = "Unknown",
        strategy = "Similarity Search"
    } = options;

    if (!template) return "";

    return template
        .replace("{policy_intro}", policyIntro)
        .replace("{element_name}", elementName)
        .replace("{cible_id}", targetId)
        .replace("{similar_id}", referenceIds)
        .replace("{strategy_used}", strategy)
        .replace("{comparison_data}", comparisonData);
}
