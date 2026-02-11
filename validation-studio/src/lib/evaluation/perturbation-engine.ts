import { v4 as uuidv4 } from 'uuid';

export interface PerturbationConfig {
    moduleSelectionMode: 'all' | 'custom';
    selectedModules: string[];
    percentageMode: 'all' | 'custom';
    globalPercentage: number[];
    modulePercentages: Record<string, number[]>;
    selectedAttributeTypes: string[];
}

export class PerturbationEngine {
    private stats: Record<string, number> = {};

    constructor() {
        this.stats = {};
    }

    public getStats(): Record<string, number> {
        return { ...this.stats };
    }

    private incrementStat(name: string) {
        this.stats[name] = (this.stats[name] || 0) + 1;
    }

    /**
     * Main entry point. Parses the prompt, finds the DATA TO VALIDATE table,
     * perturbs the TARGET column, and returns the reconstructed prompt.
     */
    public injectPerturbations(prompt: string, config?: PerturbationConfig): string {
        return this.injectPerturbationsWithTracking(prompt, config).prompt;
    }

    /**
     * Same as injectPerturbations, but also returns the list of paths that were perturbed.
     * Used for computing precision/recall metrics.
     */
    public injectPerturbationsWithTracking(prompt: string, config?: PerturbationConfig): { prompt: string; perturbedPaths: string[] } {
        const lines = prompt.split('\n');
        const perturbedLines: string[] = [];
        const perturbedPaths: string[] = [];
        let insideTable = false;
        let tableHeaderIndex = -1;
        let targetColIndex = -1;
        let pathColIndex = -1;

        // markers
        const START_MARKER = "DATA TO VALIDATE";

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Detect Start of Data Section
            if (line.includes(START_MARKER)) {
                perturbedLines.push(line);
                continue;
            }

            // Detect Table Header
            if (line.includes("|") && line.includes("TARGET") && !insideTable) {
                // Check if it looks like a header
                const parts = line.split("|").map(s => s.trim());
                const targetIdx = parts.indexOf("TARGET");
                const pathIdx = parts.indexOf("PATH");

                if (targetIdx !== -1) {
                    insideTable = true;
                    targetColIndex = targetIdx;
                    pathColIndex = pathIdx;
                    tableHeaderIndex = i;
                    perturbedLines.push(line);
                    continue;
                }
            }

            // If inside table
            if (insideTable) {
                if (line.trim() === '' || line.startsWith('------')) {
                    insideTable = false;
                    perturbedLines.push(line);
                    continue;
                }

                if (line.includes("--- | ---")) {
                    perturbedLines.push(line); // Separator row
                    continue;
                }

                // Process Data Row
                const parts = line.split("|");
                if (parts.length > targetColIndex) {
                    const originalValue = parts[targetColIndex].trim();
                    let pathValue = "";
                    if (pathColIndex !== -1 && parts.length > pathColIndex) {
                        pathValue = parts[pathColIndex].trim();
                    }

                    // Determine if we should perturb this row based on config
                    if (this._shouldPerturb(pathValue, originalValue, config)) {
                        const perturbedValue = this._perturbValue(originalValue);
                        // Only update if changed
                        if (perturbedValue !== originalValue) {
                            parts[targetColIndex] = ` ${perturbedValue} `;
                            perturbedPaths.push(pathValue);
                        }
                    }
                }
                perturbedLines.push(parts.join("|"));
            } else {
                perturbedLines.push(line);
            }
        }

        return { prompt: perturbedLines.join('\n'), perturbedPaths };
    }

    private _shouldPerturb(path: string, value: string, config?: PerturbationConfig): boolean {
        if (!config) return Math.random() < 0.3; // Default fallback

        // 1. Check Module Selection
        // Extract module name from path (e.g. "Event.Name" -> "Event")
        const moduleName = path.split('.')[0];

        // If custom mode and module not selected, skip
        if (config.moduleSelectionMode === 'custom' && !config.selectedModules.includes(moduleName)) {
            return false;
        }

        // 2. Check Attribute Type
        if (config.selectedAttributeTypes && config.selectedAttributeTypes.length > 0) {
            const type = this._inferType(value);
            // Map our internal types to the config display names
            if (type === 'uuid' && !config.selectedAttributeTypes.includes('UUID')) return false;
            if (type === 'date' && !config.selectedAttributeTypes.includes('Date')) return false;
            if (type === 'boolean' && !config.selectedAttributeTypes.includes('Boolean')) return false;
            if (type === 'integer' && !config.selectedAttributeTypes.includes('Integer')) return false;
            if (type === 'float' && !config.selectedAttributeTypes.includes('Float')) return false;
            if (type === 'string' && !config.selectedAttributeTypes.includes('String')) return false;
        }

        // 3. Determine Probability
        let min = 10;
        let max = 30;

        if (config.percentageMode === 'custom' && config.modulePercentages[moduleName]) {
            [min, max] = config.modulePercentages[moduleName];
        } else if (config.percentageMode === 'all' && config.globalPercentage) {
            [min, max] = config.globalPercentage;
        }

        // Calculate probability - use average of min and max
        const probability = ((min + max) / 2) / 100;

        return Math.random() < probability;
    }

    private _inferType(value: string): string {
        if (value.toLowerCase() === "null") return "null";
        if (value === "") return "string";
        if (this._isUuid(value)) return "uuid";
        if (this._isDate(value)) return "date";
        if (this._isBoolean(value)) return "boolean";
        if (this._isInteger(value)) return "integer";
        if (this._isFloat(value)) return "float";
        return "string";
    }

    private _perturbValue(value: string): string {
        if (value.toLowerCase() === "null") return this._perturbNull();
        if (value === "") return this._perturbEmptyString();
        if (this._isUuid(value)) return this._perturbUuid(value);
        if (this._isDate(value)) return this._perturbDate(value);
        if (this._isBoolean(value)) return this._perturbBoolean(value);
        if (this._isInteger(value)) return this._perturbInteger(value);
        if (this._isFloat(value)) return this._perturbFloat(value);

        return this._perturbString(value);
    }

    // --- Type Checkers ---

    private _isUuid(value: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }

    private _isDate(value: string): boolean {
        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/,
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
            /^\d{4}-\d{2}-\d{2}$/
        ];
        return datePatterns.some(p => p.test(value));
    }

    private _isBoolean(value: string): boolean {
        return ["true", "false"].includes(value.toLowerCase());
    }

    private _isInteger(value: string): boolean {
        return /^-?\d+$/.test(value);
    }

    private _isFloat(value: string): boolean {
        return /^-?\d+\.\d+$/.test(value);
    }

    // --- Perturbation Strategies (Helpers) ---

    private _applyStrategy(strategies: [string, (v?: any) => string][], value?: any): string {
        const [name, func] = strategies[Math.floor(Math.random() * strategies.length)];
        this.incrementStat(name);
        return func(value);
    }

    private _perturbNull(): string {
        return this._applyStrategy([
            ["null_to_empty", () => ""],
            ["null_to_zero", () => "0"],
            ["null_to_false", () => "false"],
            ["null_to_random_int", () => Math.floor(Math.random() * 10000).toString()],
        ]);
    }

    private _perturbEmptyString(): string {
        return this._applyStrategy([
            ["empty_to_null", () => "null"],
            ["empty_to_random_int", () => Math.floor(Math.random() * 10000).toString()],
            ["empty_to_string", () => "random_str"]
        ]);
    }

    private _perturbBoolean(value: string): string {
        return this._applyStrategy([
            ["boolean_flip", (v) => v.toLowerCase() === "true" ? "false" : "true"],
            ["boolean_to_empty", () => ""],
            ["boolean_to_null", () => "null"],
        ], value);
    }

    private _perturbUuid(value: string): string {
        return this._applyStrategy([
            ["uuid_random", () => uuidv4()],
            ["uuid_to_empty", () => ""],
            ["uuid_to_null", () => "null"],
            ["uuid_mutation", (v) => this._mutateUuid(v)]
        ], value);
    }

    private _mutateUuid(value: string): string {
        const chars = value.split('');
        const hexChars = "0123456789abcdef";
        for (let i = 0; i < chars.length; i++) {
            if (chars[i] !== '-' && Math.random() < 0.1) {
                chars[i] = hexChars[Math.floor(Math.random() * hexChars.length)];
            }
        }
        return chars.join('');
    }

    private _perturbDate(value: string): string {
        return this._applyStrategy([
            ["date_to_empty", () => ""],
            ["date_to_null", () => "null"],
            ["date_random", () => new Date(Date.now() + (Math.random() - 0.5) * 100000000000).toISOString()],
            ["date_shift", (v) => {
                try {
                    const d = new Date(v);
                    d.setDate(d.getDate() + Math.floor((Math.random() - 0.5) * 30));
                    if (v.includes('T')) return d.toISOString();
                    return d.toISOString().split('T')[0];
                } catch { return v; }
            }],
        ], value);
    }

    private _perturbInteger(value: string): string {
        const intVal = parseInt(value, 10);
        return this._applyStrategy([
            ["integer_to_empty", () => ""],
            ["integer_to_null", () => "null"],
            ["integer_random", () => Math.floor(Math.random() * 20000 - 10000).toString()],
            ["integer_inc_dec", (v) => (v + (Math.random() < 0.5 ? 1 : -1)).toString()],
            ["integer_to_zero", () => "0"],
        ], intVal);
    }

    private _perturbFloat(value: string): string {
        const floatVal = parseFloat(value);
        return this._applyStrategy([
            ["float_to_empty", () => ""],
            ["float_to_null", () => "null"],
            ["float_offset", (v) => (v + (Math.random() - 0.5) * 10).toFixed(2)],
            ["float_to_zero", () => "0.0"],
        ], floatVal);
    }

    private _perturbString(value: string): string {
        return this._applyStrategy([
            ["string_to_empty", () => ""],
            ["string_truncation", (v) => v.length > 1 ? v.substring(0, Math.floor(v.length / 2)) : ""],
            ["string_reversal", (v) => v.split('').reverse().join('')],
            ["string_char_sub", (v) => {
                const chars = v.split('');
                if (chars.length > 0) {
                    chars[Math.floor(Math.random() * chars.length)] = 'X';
                }
                return chars.join('');
            }]
        ], value);
    }
}
