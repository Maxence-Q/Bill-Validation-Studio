import crypto from "crypto"
import { v4 as uuidv4 } from "uuid"
import { WidgetDefinition, WidgetSnapshot } from "@/types/widget"
import { appendSnapshot } from "@/lib/dashboard/widget-storage"
import { loadEvaluationHistory, selectRuns } from "@/lib/dashboard/evaluationHistory"

function hashQuery(definition: WidgetDefinition): string {
    const payload = JSON.stringify({
        runSelection: definition.query.runSelection,
        scope: definition.query.scope,
        metrics: definition.query.metrics,
        groupBy: definition.query.groupBy,
        aggregation: definition.query.aggregation,
    })
    return crypto.createHash("sha1").update(payload).digest("hex").slice(0, 12)
}

export interface SnapshotOptions {
    overrideRunSelection?: { type: "latest"; count: number }
    note?: string
}

export function computeDistributionSlices(
    runs: import("@/lib/dashboard/evaluationHistory").EvaluationRun[],
    scopeModules: string[],
    scopePertTypes: string[],
    metricKey: "fp" | "tp" | "fn" | "precision" | "recall",
    aggregation: string | null | undefined
) {
    // Accumulate total for each perturbation type across selected runs
    // buckets: { [perturbation_type]: number }
    const buckets: Record<string, number> = {}

    for (const run of runs) {
        if (!run.typeModuleMetrics) continue

        const modulesToConsider = scopeModules.length > 0 ? scopeModules : Object.keys(run.typeModuleMetrics)

        for (const mod of modulesToConsider) {
            const typesObj = run.typeModuleMetrics[mod]
            if (!typesObj) continue

            const typesToConsider = scopePertTypes.length > 0 ? scopePertTypes : Object.keys(typesObj)

            for (const pt of typesToConsider) {
                const metricsObj = typesObj[pt]
                if (!metricsObj) continue

                const val = (metricsObj as any)[metricKey] ?? 0
                if (val > 0) {
                    buckets[pt] = (buckets[pt] || 0) + val
                }
            }
        }
    }

    // Apply aggregation (average across selected runs)
    if (aggregation === "avg" && runs.length > 0) {
        for (const pt in buckets) {
            buckets[pt] = buckets[pt] / runs.length
        }
    }

    // Convert to slices
    const totalCount = Object.values(buckets).reduce((a, b) => a + b, 0)

    const slices = Object.entries(buckets)
        .filter(([_, value]) => value > 0)
        .map(([category, value]) => ({
            category,
            value: Number(value.toFixed(2)), // round to 2 decimals
            percent: totalCount > 0 ? value / totalCount : 0
        }))

    // Sort descending
    slices.sort((a, b) => b.value - a.value)

    return slices
}

export async function generateDistributionSnapshot(
    widgetId: string,
    definition: WidgetDefinition,
    options?: SnapshotOptions
) {
    const { query } = definition
    const { scope, metrics, groupBy, aggregation } = query
    const runSelection = options?.overrideRunSelection ?? query.runSelection
    const scopeModules = scope.modules ?? []
    const scopePertTypes = scope.perturbationTypes ?? []
    const metricName = metrics[0] ?? "false_positives"

    // Map UI metric name to raw json key
    const metricKey = metricName === "false_positives" ? "fp" :
        metricName === "true_positives" ? "tp" :
            metricName === "false_negatives" ? "fn" : "fp"

    const now = new Date().toISOString()

    const history = await loadEvaluationHistory()
    const runs = selectRuns(history, runSelection)

    if (runs.length === 0) {
        throw new Error(
            "No matching evaluation runs found. " +
            "Broaden your module selection or add more evaluation runs."
        )
    }

    if (groupBy !== "perturbation_type") {
        throw new Error("Distribution widget currently only supports groupBy 'perturbation_type'.")
    }

    const slices = computeDistributionSlices(runs, scopeModules, scopePertTypes, metricKey as any, aggregation)

    const selectionMode =
        runSelection.type === "latest"
            ? `Latest ${runSelection.count > 0 ? runSelection.count : "all"} runs`
            : runSelection.type === "dateRange"
                ? `Date range: ${runSelection.start} → ${runSelection.end}`
                : `${(runSelection as { runBatchIds?: string[] }).runBatchIds?.length ?? 0} run(s)`

    const snapshot: WidgetSnapshot = {
        snapshotId: uuidv4(),
        createdAt: now,
        runSelection,
        slices,
        queryHash: hashQuery(definition),
        modules: scopeModules,
        metrics: [...metrics],
        selectionMode,
        aggregation: aggregation ?? null,
        runsUsed: runs.map((r) => ({ id: r.id, timestamp: r.timestamp })),
        ...(options?.note ? { note: options.note.trim() } : {}),
    }

    return appendSnapshot(widgetId, snapshot)
}
