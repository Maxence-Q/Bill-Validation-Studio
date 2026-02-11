export function formatCsvComparison(targetStr: string, similarStrs: string | string[]): string {
    const refs = Array.isArray(similarStrs) ? similarStrs : [similarStrs];

    // 1. Parsing Target
    const targetDict: Record<string, string> = {};
    const targetLines = targetStr.split("\n");

    for (const line of targetLines) {
        const trimmed = line.trim();
        if (trimmed.includes(":")) {
            const [key, ...rest] = trimmed.split(":");
            const val = rest.join(":").trim();
            targetDict[key.trim()] = val;
        }
    }

    // 2. Parsing References
    const refDicts: Record<string, string>[] = refs.map((refStr) => {
        const dict: Record<string, string> = {};
        if (refStr) {
            const lines = refStr.split("\n");
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.includes(":")) {
                    const [key, ...rest] = trimmed.split(":");
                    const val = rest.join(":").trim();
                    dict[key.trim()] = val;
                }
            }
        }
        return dict;
    });

    // 3. Construct Table
    const header = ["PATH", "TARGET", ...refs.map((_, i) => `REF ${i + 1}`)].join(" | ");
    const separator = ["---", "---", ...refs.map(() => "---")].join(" | ");

    const lines = [header, separator];

    for (const [key, targetVal] of Object.entries(targetDict)) {
        const tClean = targetVal.replace(/\|/g, "/");

        const refVals = refDicts.map(d => {
            const val = d[key] || "<NO REFERENCE>";
            return val.replace(/\|/g, "/");
        });

        lines.push(`${key} | ${tClean} | ${refVals.join(" | ")}`);
    }

    return lines.join("\n");
}
