SYSTEM_MESSAGE_EN = """
You are an expert assistant in validating ticketing event configurations.
Your role is to perform precise verification on a TARGET event by comparing it to SIMILAR reference events.

Rules:
- You MUST use the `report_step_issues` tool to provide your response.
- If anomalies are detected: list them with precision (path, severity, explanatory message).
- If NO anomalies are detected: call `report_step_issues` with an empty issues list [].
- Never provide text or comments outside of the tool call.
""".strip()


PROMPT_FORMAT_PATHS_TEMPLATE_EN = """
You are an assistant helping to identify relevant paths in a complex JSON data structure.

Description of what we are looking to identify:
---
{description}
---

Here is the list of paths available in the JSON data structure.
You must only choose from these paths, without inventing new ones:
---
{paths_list}
---

Your task:
- Select ONLY the paths that best match the provided description.
- You can choose multiple, one, or none.
- If no path matches, return an empty list.

IMPORTANT:
- You MUST call the `format_paths` function to return the final list of selected paths.
- Do not provide free text, do not explain your reasoning: use only `format_paths`.
""".strip()

VALIDATE_SECTION_PROMPT_EN = """
CONTEXT:
{policy_intro}

POINT TO VERIFY ({check_num}/{total_checks}): "{check_name}"

SPECIFIC INSTRUCTIONS:
{instruction}

--------------------------------------------------
TARGET EVENT DATA (ID: {cible_id})
--------------------------------------------------
{target_content}

--------------------------------------------------
SIMILAR EVENTS DATA (REFERENCES)
--------------------------------------------------
{similar_content}

--------------------------------------------------

TASK:
Analyze the provided data ONLY with respect to the point to verify.
If you detect anomalies, use the `report_step_issues` tool to report them.
If everything is correct, call `report_step_issues` with an empty list.
""".strip()

VALIDATE_SECTION_SPEC_PROMPT_EN = """
CONTEXT:

Element to validate ({element_num}/{total_elements}):

{policy_intro}

--------------------------------------------------
TARGET EVENT DATA (ID: {cible_id})
--------------------------------------------------
{data_element}

--------------------------------------------------
SIMILAR EVENTS DATA (REFERENCES)
--------------------------------------------------
NO SIMILAR EVENTS DATA FOR THIS MODULE

--------------------------------------------------

TASK:
Analyze the provided data ONLY with respect to the point to verify.
If you detect anomalies, use the `report_step_issues` tool to report them.
If everything is correct, call `report_step_issues` with an empty list.
""".strip()

tool_report_step_issues = {
    "type": "function",
    "function": {
        "name": "report_step_issues",
        "description": (
            "Reports the result of the verification analysis for the current step. "
            "Must be called even if no anomalies are found (with an empty list)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "issues": {
                    "type": "array",
                    "description": "List of detected anomalies. Leave empty [] if everything is correct.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Path or field name affected (e.g., 'Event.NameFR')."
                            },
                            "severity": {
                                "type": "string",
                                "enum": ["error", "warning", "info"],
                                "description": "Use 'error' for blocking/obvious faults, 'warning' for suspected inconsistencies, 'info' for observations."
                            },
                            "message": {
                                "type": "string",
                                "description": "Short explanation of the problem, mentioning the difference with similar events."
                            },
                            "suggestion": {
                                "type": "string",
                                "description": "Suggested action to fix (optional)."
                            },
                        },
                        "required": ["path", "severity", "message"],
                    },
                },
            },
            "required": ["issues"],
        },
    },
}


tool_format_paths = {
    "type": "function",
    "function": {
        "name": "format_paths",
        "description": (
            "Selects and returns the final list of relevant paths "
            "from those proposed."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "paths": {
                    "type": "array",
                    "description": "List of paths selected as relevant.",
                    "items": {
                        "type": "string",
                    },
                }
            },
            "required": ["paths"],
        },
    },
}



TOOLS_VALIDATOR_EN: list = [
    tool_report_step_issues
]

TOOLS_PROVIDER_EN: list = [
    tool_format_paths,
]

# Aliases for convenience
SYSTEM_MESSAGE_EN = SYSTEM_MESSAGE_EN
PROMPT_FORMAT_PATHS_TEMPLATE_EN = PROMPT_FORMAT_PATHS_TEMPLATE_EN
VALIDATE_SECTION_PROMPT_EN = VALIDATE_SECTION_PROMPT_EN
TOOLS_VALIDATOR_EN = TOOLS_VALIDATOR_EN
TOOLS_PROVIDER_EN = TOOLS_PROVIDER_EN

