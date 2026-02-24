import { DataItem } from "@/types/validation";
import fs from "fs";
import path from "path";

/**
 * Automatically assigns rules to attributes based on their type/content.
 */
export class RuleProcessor {
    private static loadRules(): Record<string, string> {
        const rulesPath = path.join(process.cwd(), "artefacts", "description_donnee.md");
        try {
            const content = fs.readFileSync(rulesPath, "utf-8");
            const rules: Record<string, string> = {};

            content.split("\n").forEach(line => {
                if (line.includes(":")) {
                    const [key, ...value] = line.split(":");
                    const cleanKey = key.trim().toUpperCase();
                    rules[cleanKey] = value.join(":").trim();
                }
            });

            return rules;
        } catch (error) {
            console.error("Failed to load rules from description_donnee.md:", error);
            // Fallback to empty or basic rules if file missing
            return {};
        }
    }

    static applyRules(items: DataItem[]): DataItem[] {
        const rulesContent = this.loadRules();

        return items.map(item => {
            const rules: Record<string, string> = {};

            for (const [key, value] of Object.entries(item.target)) {
                rules[key] = this.determineRule(key, value, rulesContent);
            }

            return {
                ...item,
                rules
            };
        });
    }

    private static determineRule(key: string, value: string, rules: Record<string, string>): string {
        const lowerKey = key.toLowerCase();
        const cleanValue = value ? value.trim() : "";

        // 1. UUID Check
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(cleanValue)) {
            return rules.UUID || "UUID check";
        }

        // 2. ID Check (name contains 'id')
        if (lowerKey.includes("id")) {
            return rules.ID || "ID check";
        }

        // 3. Boolean Check
        if (cleanValue.toLowerCase() === "true" || cleanValue.toLowerCase() === "false") {
            return rules.BOOLEAN || "Boolean check";
        }

        // 4. URL/Link Check
        if (lowerKey.includes("link") || lowerKey.includes("url") || cleanValue.startsWith("http")) {
            return rules.STRING || "String check";
        }

        // 5. Date Check (Basic heuristic)
        const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/;
        const slashesRegex = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/; // Matches 2024/01/01 or 01/01/2024

        const isDateLike = dateRegex.test(cleanValue) || slashesRegex.test(cleanValue);

        if (isDateLike && !isNaN(Date.parse(cleanValue))) {
            return rules.DATE || "Date check";
        }

        // 6. Number checks
        if (cleanValue !== "" && !isNaN(Number(cleanValue))) {
            if (cleanValue.includes(".")) {
                return rules.FLOAT || "Float check";
            }
            return rules.INTEGER || "Integer check";
        }

        // 7. Default String
        return rules.STRING || "String check";
    }
}
