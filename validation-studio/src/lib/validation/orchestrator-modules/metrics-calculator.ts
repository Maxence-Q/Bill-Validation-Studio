export interface TypeMetrics {
    total: number;
    tp: number;
    fp: number;
    fn: number;
}

export interface ValidationMetrics {
    precision: number;
    recall: number;
    tp: number;
    fp: number;
    fn: number;
    moduleMetrics?: Record<string, any>;
    typeModuleMetrics?: Record<string, Record<string, TypeMetrics>>;
}

export class MetricsCalculator {
    static calculateMetrics(allIssues: any[], allPerturbationTracking: Record<string, any[]>): ValidationMetrics | undefined {
        if (Object.keys(allPerturbationTracking).length === 0) return undefined;

        // Flatten tracking, mapping original details plus the new typeMap
        const allPerturbedPathsFlat = Object.entries(allPerturbationTracking).flatMap(([mod, items]) =>
            (items as any[]).flatMap(item => {
                const typeMap = item.typeMap || {}; // Fallback if missing
                return (item.details || []).map((d: any) =>
                    ({ module: mod, index: item.index, path: d.path, type: typeMap[d.path] || 'unknown' })
                );
            })
        );

        const totalPerturbations = allPerturbedPathsFlat.length;

        // Initialize Module Stats
        const moduleStats: Record<string, { tp: number, fp: number, total: number }> = {};
        const typeStats: Record<string, Record<string, TypeMetrics>> = {};

        // Count totals per module
        allPerturbedPathsFlat.forEach(p => {
            if (!moduleStats[p.module]) moduleStats[p.module] = { tp: 0, fp: 0, total: 0 };
            moduleStats[p.module].total++;

            if (!typeStats[p.module]) typeStats[p.module] = {};
            if (!typeStats[p.module][p.type]) typeStats[p.module][p.type] = { total: 0, tp: 0, fp: 0, fn: 0 };
            typeStats[p.module][p.type].total++;
        });

        const matchedPerturbations = new Set<string>(); // Use string ID for uniqueness
        let globalTp = 0;
        let globalFp = 0;

        for (const issue of allIssues) {
            if (issue.path === "API_LIMIT_REACHED") continue;

            // Initialize stats if not present (e.g. for FP in non-perturbed module)
            if (!moduleStats[issue.module]) moduleStats[issue.module] = { tp: 0, fp: 0, total: 0 };

            const issuePath = issue.path || "";

            const matchIdx = allPerturbedPathsFlat.findIndex((p, idx) => {
                const pId = `${p.module}-${p.index}-${idx}`; // Index in flat array
                if (matchedPerturbations.has(pId)) return false;
                if (p.module !== issue.module) return false;

                if (p.index !== issue.itemIndex) return false;

                // Strict matching (Exact Path)
                // We use trim() just in case of whitespace artifacts, but avoid includes()
                return p.path.trim() === issuePath.trim();
            });

            if (matchIdx !== -1) {
                globalTp++;
                const matchedPath = allPerturbedPathsFlat[matchIdx];
                matchedPerturbations.add(`${matchedPath.module}-${matchedPath.index}-${matchIdx}`);
                moduleStats[issue.module].tp++;
                if (typeStats[issue.module] && typeStats[issue.module][matchedPath.type]) {
                    typeStats[issue.module][matchedPath.type].tp++;
                }
                issue.classification = 'TP';
            } else {
                globalFp++;
                moduleStats[issue.module].fp++;

                // Infer type for False Positives by looking it up in the corresponding typeMap for that item
                let fpType = 'unknown';
                const moduleTracking = allPerturbationTracking[issue.module];
                if (moduleTracking) {
                    const itemTracking = (moduleTracking as any[]).find(t => t.index === issue.itemIndex);
                    if (itemTracking && itemTracking.typeMap && itemTracking.typeMap[issuePath]) {
                        fpType = itemTracking.typeMap[issuePath];
                    }
                }

                if (!typeStats[issue.module]) typeStats[issue.module] = {};
                if (!typeStats[issue.module][fpType]) typeStats[issue.module][fpType] = { total: 0, tp: 0, fp: 0, fn: 0 };
                typeStats[issue.module][fpType].fp++;

                issue.classification = 'FP';
            }
        }

        const globalFn = totalPerturbations - globalTp;
        const globalPrecision = (globalTp + globalFp) > 0 ? globalTp / (globalTp + globalFp) : 1;
        const globalRecall = totalPerturbations > 0 ? globalTp / totalPerturbations : 1;

        const moduleMetrics: Record<string, any> = {};
        Object.keys(moduleStats).forEach(m => {
            const stats = moduleStats[m];
            const fn = stats.total - stats.tp;
            const precision = (stats.tp + stats.fp) > 0 ? stats.tp / (stats.tp + stats.fp) : 1;
            const recall = stats.total > 0 ? stats.tp / stats.total : 1;
            moduleMetrics[m] = { precision, recall, tp: stats.tp, fp: stats.fp, fn };
        });

        // Finalize type metrics (calculate FN)
        Object.keys(typeStats).forEach(m => {
            Object.keys(typeStats[m]).forEach(t => {
                const stat = typeStats[m][t];
                stat.fn = stat.total - stat.tp;
            });
        });

        return {
            precision: globalPrecision,
            recall: globalRecall,
            tp: globalTp,
            fp: globalFp,
            fn: globalFn,
            moduleMetrics,
            typeModuleMetrics: typeStats
        };
    }
}
