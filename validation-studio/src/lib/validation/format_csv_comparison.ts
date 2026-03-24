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

    const isSummaryChunk = target["__is_summary_chunk"] === "true";
    const lines = [header, separator];

    // 2. Add Data Rows (skip POSPriceGroups.* and __ internal keys)
    const isPricesModule = item.target["__module"] === "Prices";

    for (const [key, targetVal] of Object.entries(target)) {
        if (key.startsWith("POSPriceGroups.") || key.startsWith("__")) continue;

        // Skip anything with "ID" (case-sensitive) if we are in Prices module
        if (isPricesModule && key.includes("ID")) continue;

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

    // 3. POSPriceGroups Summary Section (Only for designated summary chunks)
    const posName = target["RO_PointOfSaleName"] || "";
    const posPgSummary = isSummaryChunk ? buildPosPriceGroupsSummary(target, references, posName) : null;

    // 4. Return Final Selection
    // If only summary remains (dedicated chunk), skip the empty main table header
    if (lines.length === 2 && posPgSummary) {
        return posPgSummary;
    }

    if (posPgSummary) {
        lines.push("");
        lines.push(posPgSummary);
    }

    return lines.join("\n");
}

/**
 * Extracts the human-readable label from a resolved EventPriceGroupID value.
 * Input:  "2541 (Régulier)"  → Output: "Régulier"
 * Input:  "2541"             → Output: "2541"
 */
function extractPgLabel(value: string): string {
    const match = value.match(/\((.+)\)$/);
    return match ? match[1] : value.trim();
}

/**
 * Collects all price group labels from a record's POSPriceGroups keys.
 * Returns a Set of human-readable labels.
 */
function collectPgLabels(record: Record<string, string>): Set<string> {
    const labels = new Set<string>();
    for (const [key, val] of Object.entries(record)) {
        if (key.startsWith("POSPriceGroups.") && key.endsWith(".EventPriceGroupID") && val) {
            labels.add(extractPgLabel(val));
        }
    }
    return labels;
}

/**
 * Builds the POSPriceGroups summary sub-table for a DataItem.
 * Returns null if the target has no POSPriceGroups keys.
 */
function buildPosPriceGroupsSummary(
    target: Record<string, string>,
    references: Record<string, string>[],
    posName: string
): string | null {
    const targetLabels = collectPgLabels(target);

    // Collect labels from each reference
    const refLabelSets = references.map(ref => collectPgLabels(ref));

    // Build union of all labels
    const allLabels = new Set<string>(targetLabels);
    for (const refSet of refLabelSets) {
        for (const label of refSet) {
            allLabels.add(label);
        }
    }

    if (allLabels.size === 0) return null;

    // Build the summary table
    const summaryLines: string[] = [];
    const header = posName
        ? `Price Groups for the point of sale ${posName}:`
        : "Price Groups:";
    summaryLines.push(header);

    const sortedLabels = Array.from(allLabels).sort();
    for (const label of sortedLabels) {
        const targetHas = targetLabels.has(label) ? "✓" : "✗";
        const refHas = refLabelSets.map(refSet => refSet.has(label) ? "✓" : "✗");
        summaryLines.push([label, targetHas, ...refHas].join(" | "));
    }

    return summaryLines.join("\n");
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
