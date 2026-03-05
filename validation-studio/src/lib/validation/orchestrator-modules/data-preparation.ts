import { getEventContributionForModule } from "@/lib/validation/module-contribution";
import { DataItem } from "@/types/validation";

export class DataPreparation {
    static prepareModuleData(targetEvent: any, references: any[], module: string): DataItem[] {
        const targetContribution = getEventContributionForModule(module, targetEvent);
        const refContributionsByRef = references.map((ref: any) => getEventContributionForModule(module, ref));

        const dataItems: DataItem[] = [];

        // Formatting Logic
        if (!Array.isArray(targetContribution)) {
            const targetRecord = this.parseToRecord(targetContribution as string);
            const refRecords = refContributionsByRef
                .map(c => this.parseToRecord((c as string) || ""))
                .filter(r => Object.keys(r).length > 0);
            dataItems.push({ target: targetRecord, references: refRecords });
        } else {
            // List Logic with Fuzzy Matching
            let marker = "";
            if (module === "Prices") marker = "PriceGroup.PriceGroupNameFr: ";
            else if (module === "PriceGroups") marker = "Name: ";
            else if (module === "RightToSellAndFees") marker = "RO_PointOfSaleName: ";

            (targetContribution as string[]).forEach((targetElementStr) => { 
                const similarRecords: Record<string, string>[] = [];
                const targetName = this.extractSpecElementName(marker, targetElementStr);

                const fallbacks: string[] = [];

                // For each reference, find the best match
                for (const refContribution of refContributionsByRef) {
                    let foundSimilarStr = "";
                    const refList = refContribution as string[];

                    if (Array.isArray(refList) && refList.length > 0) {
                        fallbacks.push(refList[0]);
                        // 1. Exact Match
                        if (targetName) {
                            for (const simElementStr of refList) {
                                if (this.extractSpecElementName(marker, simElementStr) === targetName) {
                                    foundSimilarStr = simElementStr;
                                    break;
                                }
                            }
                        }

                        // 2. Fuzzy Match
                        if (!foundSimilarStr && targetName) {
                            let bestMatch = "";
                            let bestScore = 0.0;
                            for (const simElementStr of refList) {
                                const simName = this.extractSpecElementName(marker, simElementStr);
                                if (simName) {
                                    const score = this.similarity(targetName.toLowerCase(), simName.toLowerCase());
                                    if (score > bestScore) {
                                        bestScore = score;
                                        bestMatch = simElementStr;
                                    }
                                }
                            }
                            if (bestMatch) foundSimilarStr = bestMatch;
                        }
                    }

                    if (foundSimilarStr) {
                        similarRecords.push(this.parseToRecord(foundSimilarStr));
                    }
                }

                if (similarRecords.length === 0 && fallbacks.length > 0) {
                    similarRecords.push(this.parseToRecord(fallbacks[0]));
                }

                dataItems.push({
                    target: this.parseToRecord(targetElementStr),
                    references: similarRecords
                });
            });
        }
        return dataItems;
    }

    private static parseToRecord(str: string): Record<string, string> {
        const record: Record<string, string> = {};
        if (!str) return record;

        const lines = str.split("\n");
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.includes(":")) {
                const [key, ...rest] = trimmed.split(":");
                const val = rest.join(":").trim();
                record[key.trim()] = val;
            }
        }
        return record;
    }

    private static similarity(s1: string, s2: string): number {
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;
        if (longer.length === 0) {
            return 1.0;
        }
        const costs = new Array();
        for (let i = 0; i <= shorter.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= longer.length; j++) {
                if (i == 0)
                    costs[j] = j;
                else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (s1.charAt(i - 1) != s2.charAt(j - 1))
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0)
                costs[longer.length] = lastValue;
        }
        return (longer.length - costs[longer.length]) / parseFloat(longer.length.toString());
    }

    private static extractSpecElementName(marker: string, targetElementStr: string): string | null {
        if (!marker) return null; // Simple heuristic for empty marker
        const startIndex = targetElementStr.indexOf(marker);
        if (startIndex === -1) return null;

        const endIndex = targetElementStr.indexOf("\n", startIndex);
        if (endIndex === -1) {
            return targetElementStr.substring(startIndex + marker.length).trim();
        }
        return targetElementStr.substring(startIndex + marker.length, endIndex).trim();
    }
}
