import { DataItem } from "@/types/validation";

export function formatDataItemToCsv(item: DataItem): string {
    const { target, references, rules } = item;

    // 1. Construct Table Headers
    const hasRules = !!rules;
    const headerCols = ["PATH", "TARGET", ...references.map((_, i) => `REF ${i + 1}`)];
    if (hasRules) headerCols.push("RULE");
    const header = headerCols.join(" | ");

    const sepCols = ["---", "---", ...references.map(() => "---")];
    if (hasRules) sepCols.push("---");
    const separator = sepCols.join(" | ");

    const lines = [header, separator];

    // 2. Add Data Rows
    for (const [key, targetVal] of Object.entries(target)) {
        const tClean = targetVal ? targetVal.toString().replace(/\|/g, "/") : "";

        const refVals = references.map(d => {
            const val = d[key] || "<NO REFERENCE>";
            return val.toString().replace(/\|/g, "/");
        });

        const rowCols = [key, tClean, ...refVals];
        if (hasRules) {
            const rule = rules[key] || "";
            rowCols.push(rule.replace(/\|/g, "/"));
        }

        lines.push(rowCols.join(" | "));
    }

    return lines.join("\n");
}

/** Legacy support for string-based inputs */
export function formatCsvComparison(targetStr: string, similarStrs: string | string[]): string {
    const refs = Array.isArray(similarStrs) ? similarStrs : [similarStrs];

    // Parse strings to records
    const parse = (s: string) => {
        const dict: Record<string, string> = {};
        s.split("\n").forEach(l => {
            if (l.includes(":")) {
                const [k, ...v] = l.split(":");
                dict[k.trim()] = v.join(":").trim();
            }
        });
        return dict;
    };

    return formatDataItemToCsv({
        target: parse(targetStr),
        references: refs.map(r => parse(r))
    });
}
