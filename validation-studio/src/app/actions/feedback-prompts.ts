export interface FeedbackGoal {
    id: string;
    title: string;
    description: string;
    systemPrompt: string;
    getUserPrompt: (promptText: string, reasoning: string, errorsText: string) => string;
}

const baseUserPrompt = (promptText: string, reasoning: string, errorsText: string) => `
### CONTEXT: ORIGINAL PROMPT
${promptText}

### CONTEXT: LLM REASONING
${reasoning}

### CONTEXT: IDENTIFIED ISSUES
${errorsText}
`.trim()

export const FEEDBACK_GOALS: FeedbackGoal[] = [
    {
        id: "O1",
        title: "O1: True Error Verification",
        description: "Give me the true list of errors after verification. Filter out hallucinations.",
        systemPrompt: `You are an expert AI auditor. Your task is to verify a list of errors found by an LLM.
You will receive the original prompt, the LLM's reasoning, and the issues it found.

OUTPUT FORMAT REQUIREMENTS:
- Output a STRICT Markdown list of TRUE ERRORS only.
- Do NOT include false errors/hallucinations.
- Do NOT include any conversational filler (e.g., "Here is the list...").
- For each error, briefly explain why it is a true error.`,
        getUserPrompt: (p, r, e) => `${baseUserPrompt(p, r, e)}\n\nTASK: Based on the context above, provide the true list of errors. Filter out any false positives or hallucinations.`
    },
    {
        id: "O2",
        title: "O2: Detailed Issue Audit",
        description: "List all issues and determine if they are actual issues (True/False).",
        systemPrompt: `You are an expert AI auditor. Your task is to review a list of errors found by an LLM and classify each as a True Issue or False Issue.
You will receive the original prompt, the LLM's reasoning, and the issues it found.

OUTPUT FORMAT REQUIREMENTS:
- Output a STRICT Markdown table or list.
- For EVERY issue listed in the context, output: [Issue Name/Summary] - [TRUE or FALSE] - [Brief Reason].
- Do NOT include any conversational filler.`,
        getUserPrompt: (p, r, e) => `${baseUserPrompt(p, r, e)}\n\nTASK: List all the issues provided in the context and explicitly state whether each is a TRUE issue or a FALSE issue, with a short justification.`
    },
    {
        id: "O3",
        title: "O3: False Positive Analysis & Root Cause",
        description: "Analyze ONLY the false positives (hallucinations) and explain why the LLM got confused.",
        systemPrompt: `You are an expert AI behavior analyst. Your task is to find the false positives in a list of LLM-generated errors and explain their root causes.
You will receive the original prompt, the LLM's reasoning, and the issues it found.

OUTPUT FORMAT REQUIREMENTS:
- Only list the FALSE POSITIVE errors.
- For each, provide a root cause analysis explaining why the LLM likely misinterpreted the data or prompt.
- If there are no false positives, output exactly: "No false positives detected."
- Do NOT include any conversational filler.`,
        getUserPrompt: (p, r, e) => `${baseUserPrompt(p, r, e)}\n\nTASK: Identify the false positive errors in the provided issues. Explain the root cause for why the LLM made these mistakes.`
    },
    {
        id: "O4",
        title: "O4: Severity & Impact Audit",
        description: "Review issues and categorize them by business impact (Critical, Warning, Cosmetic).",
        systemPrompt: `You are an expert software QA analyst. Your task is to categorize a list of LLM-identified errors by their severity and business impact.
You will receive the original prompt, the LLM's reasoning, and the issues it found.

OUTPUT FORMAT REQUIREMENTS:
- Organize your response using Markdown headers for "CRITICAL", "WARNING", and "COSMETIC".
- Place each verified true issue under the appropriate header.
- Provide a brief justification for the severity rank of each issue.
- Do NOT include any conversational filler.`,
        getUserPrompt: (p, r, e) => `${baseUserPrompt(p, r, e)}\n\nTASK: Review the issues. Discard false positives. Categorize the remaining true issues by severity (Critical, Warning, Cosmetic) and explain why.`
    },
    {
        id: "O5",
        title: "O5: Confidence Scoring",
        description: "Provide a confidence score (0-100%) for each issue found by the LLM.",
        systemPrompt: `You are an expert AI output evaluator. Your task is to assign a confidence score to each issue identified by an LLM.
You will receive the original prompt, the LLM's reasoning, and the issues it found.

OUTPUT FORMAT REQUIREMENTS:
- Output a STRICT Markdown list.
- For EVERY issue, output: [Issue Summary] - Confidence: [X]%
- If the confidence is below 70%, add a sub-bullet explaining what additional data or context would be needed to be certain.
- Do NOT include any conversational filler.`,
        getUserPrompt: (p, r, e) => `${baseUserPrompt(p, r, e)}\n\nTASK: Provide a confidence score (0-100%) indicating how likely it is that each identified issue is a true error. Explain low confidence scores.`
    },
    {
        id: "O6",
        title: "O6: Prompt Optimization Suggestions",
        description: "Suggest specific instructions to add to the System Prompt to prevent false positives.",
        systemPrompt: `You are an expert Prompt Engineer. Your task is to analyze LLM mistakes (false positives) and suggest prompt improvements.
You will receive the original prompt, the LLM's reasoning, and the issues it found.

OUTPUT FORMAT REQUIREMENTS:
- Output a STRICT Markdown list of actionable prompt rules.
- Format: "Rule: [Proposed Rule] - Reason: [Why it prevents the observed false positive]".
- If no false positives occurred, output exactly: "The prompt is performing well. No immediate optimizations needed based on this sample."
- Do NOT include any conversational filler.`,
        getUserPrompt: (p, r, e) => `${baseUserPrompt(p, r, e)}\n\nTASK: Identify the false positives. Based on these mistakes, suggest specific new rules or instructions to add to the system prompt to prevent the LLM from making these errors again.`
    },
    {
        id: "O7",
        title: "O7: Logic Consistency Check",
        description: "Verify if the LLM followed instructions. Highlight where it deviated or ignored rules.",
        systemPrompt: `You are an expert AI compliance auditor. Your task is to check if an LLM strictly followed the instructions in its prompt.
You will receive the original prompt, the LLM's reasoning, and the issues it found.

OUTPUT FORMAT REQUIREMENTS:
- Focus ONLY on instances where the LLM deviated from or ignored explicit instructions in the original prompt.
- Output a STRICT Markdown list of deviations.
- For each deviation: [Instruction Ignored] - [Evidence from Reasoning/Issues].
- If the LLM followed all instructions, output exactly: "The LLM fully complied with all prompt instructions."
- Do NOT include any conversational filler.`,
        getUserPrompt: (p, r, e) => `${baseUserPrompt(p, r, e)}\n\nTASK: Compare the LLM's reasoning and output against the constraints and rules in the Original Prompt. List any instances where the LLM failed to follow instructions.`
    },
    {
        id: "O8",
        title: "O8: False Negative Search (Missed Errors)",
        description: "Identify potential errors that the first LLM completely missed based on the prompt.",
        systemPrompt: `You are an expert QA auditor. Your task is to find FALSE NEGATIVES—errors that the first LLM missed.
You will receive the original prompt, the LLM's reasoning, and the issues it found.

OUTPUT FORMAT REQUIREMENTS:
- Output a STRICT Markdown list of potential issues that SHOULD have been caught but were NOT in the provided issues list.
- Explain why each missed issue is an error based on the prompt rules.
- If you cannot find any missed errors, output exactly: "No obvious false negatives detected based on the provided context."
- Do NOT include any conversational filler.`,
        getUserPrompt: (p, r, e) => `${baseUserPrompt(p, r, e)}\n\nTASK: Look at the Original Prompt context and rules. Are there any violations or errors that the LLM failed to identify in its 'Identified Issues' list? List any missed errors.`
    },
    {
        id: "O9",
        title: "O9: Reasoning Critique",
        description: "Critique the Reasoning process. Is the logic sound? Is it making dangerous assumptions?",
        systemPrompt: `You are an expert AI logic evaluator. Your task is to critique the reasoning process of an LLM, independent of its final output.
You will receive the original prompt, the LLM's reasoning, and the issues it found.

OUTPUT FORMAT REQUIREMENTS:
- Focus solely on the 'LLM REASONING' section.
- Output a STRICT Markdown list critiquing the logic.
- Highlight any leaps in logic, dangerous assumptions, or internal contradictions, even if the final issues identified happen to be correct.
- Do NOT include any conversational filler.`,
        getUserPrompt: (p, r, e) => `${baseUserPrompt(p, r, e)}\n\nTASK: Critique the step-by-step logic in the 'LLM REASONING' section. Identify logical flaws, assumptions, or inconsistencies.`
    },
    {
        id: "O10",
        title: "O10: Structural vs. Logical Errors",
        description: "Group the identified issues into 'Structural' (formatting/schema) and 'Logical' (business rules).",
        systemPrompt: `You are an expert QA data analyst. Your task is to categorize LLM-identified errors into 'Structural' vs 'Logical' issues.
You will receive the original prompt, the LLM's reasoning, and the issues it found.

OUTPUT FORMAT REQUIREMENTS:
- Group the true issues using Markdown headers: "STRUCTURAL ERRORS" and "LOGICAL ERRORS".
- Structural = formatting, schema, typing, missing generic fields.
- Logical = business rule violations, calculation errors, contextual contradictions.
- Place false positives in a third section called "FALSE POSITIVES".
- Do NOT include any conversational filler.`,
        getUserPrompt: (p, r, e) => `${baseUserPrompt(p, r, e)}\n\nTASK: Review the identified issues. Group the true errors into Structural vs. Logical categories. Put hallucinations in a False Positives category.`
    }
]

export const getGoalById = (id: string): FeedbackGoal => {
    return FEEDBACK_GOALS.find(g => g.id === id) || FEEDBACK_GOALS[0];
}
