export function formatCsvComparison(targetStr: string, similarStr: string): string {
    // 1. Parsing Target
    const targetDict: Record<string, string> = {};
    const targetLines = targetStr.split("\n");

    for (const line of targetLines) {
        const trimmed = line.trim();
        if (trimmed.includes(":")) {
            const [key, ...rest] = trimmed.split(":");
            const val = rest.join(":").trim(); // Rejoin in case value has colons
            targetDict[key.trim()] = val;
        }
    }

    // 2. Parsing Similar (Reference)
    const similarDict: Record<string, string> = {};
    if (similarStr) {
        const similarLines = similarStr.split("\n");
        for (const line of similarLines) {
            const trimmed = line.trim();
            if (trimmed.includes(":")) {
                const [key, ...rest] = trimmed.split(":");
                const val = rest.join(":").trim();
                similarDict[key.trim()] = val;
            }
        }
    }

    // 3. Construct Table
    const lines = ["PATH | TARGET | REFERENCE"];
    lines.push("--- | --- | ---");

    for (const [key, targetVal] of Object.entries(targetDict)) {
        const similarVal = similarDict[key] || "<NO REFERENCE>";

        const tClean = targetVal.replace(/\|/g, "/");
        const sClean = similarVal.replace(/\|/g, "/");

        lines.push(`${key} | ${tClean} | ${sClean}`);
    }

    return lines.join("\n");
}
