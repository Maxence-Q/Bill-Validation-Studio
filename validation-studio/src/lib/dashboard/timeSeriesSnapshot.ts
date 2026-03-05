/**
 * Time Series Snapshot Generator (Server-side)
 *
 * Builds an aggregated TimeSeriesSnapshot from a widget's definition query:
 *   - series[].points        → exactly 1 point per snapshot (aggregated value at snapshot.createdAt)
 *   - series[].drilldownPoints → per-run values used to compute the aggregation
 *
 * Sourced from evaluation_history.json via the evaluationHistory data layer.
 */

import crypto from "crypto"
import { v4 as uuidv4 } from "uuid"
import { WidgetDefinition, WidgetSnapshot, TimeSeriesSeries } from "@/types/widget"
import { appendSnapshot } from "@/lib/dashboard/widget-storage"
import {
    loadEvaluationHistory,
    selectRuns,
    computeRunMetricsByRun,
    computeAggregatedValue,
} from "@/lib/dashboard/evaluationHistory"

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Generator ───────────────────────────────────────────────────────────────

export interface SnapshotOptions {
    overrideRunSelection?: { type: "latest"; count: number }
    note?: string
}

/**
 * Generate a Time Series snapshot for the given widget and append it to
 * the widget's snapshots array.
 *
 * Each snapshot contains:
 *   - series[].points[0]         — 1 aggregated point at snapshot.createdAt
 *   - series[].drilldownPoints   — per-run values for the expansion view
 *
 * Throws if no runs found or all metric values are null.
 * Returns the updated widget.
 */
export async function generateTimeSeriesSnapshot(
    widgetId: string,
    definition: WidgetDefinition,
    options?: SnapshotOptions
) {
    const { query } = definition
    const { scope, metrics, aggregation } = query
    const runSelection = options?.overrideRunSelection ?? query.runSelection
    const scopeModules = scope.modules ?? []
    const now = new Date().toISOString()

    // 1. Load history and select runs
    const history = await loadEvaluationHistory()
    const runs = selectRuns(history, runSelection)

    if (runs.length === 0) {
        throw new Error(
            "No matching evaluation runs found. " +
            "Broaden your module selection or add more evaluation runs."
        )
    }

    // 2. Compute per-run values (will become drilldownPoints)
    const perRunMetrics = computeRunMetricsByRun(runs, scopeModules)

    // 3. Build one series per metric
    const series: TimeSeriesSeries[] = metrics.map((metric) => {
        // drilldownPoints: one entry per run
        const drilldownPoints = perRunMetrics.map((r) => ({
            x: r.timestamp,
            y: r.values[metric] !== undefined ? r.values[metric] : null,
            runId: r.runId,
        }))

        // aggregated point: avg over non-null drilldown values
        const { value: aggValue } = computeAggregatedValue(
            drilldownPoints.map((p) => p.y),
            aggregation
        )

        return {
            label: metric,
            metric,
            // Exactly 1 aggregated point at snapshot creation time
            points: [{ x: now, y: aggValue }],
            drilldownPoints,
        }
    })

    // 4. Verify at least one series has real data
    const hasAnyData = series.some((s) => s.points[0]?.y !== null)
    if (!hasAnyData) {
        throw new Error(
            "No metric data found for the selected modules and runs. " +
            "Check that the selected modules exist in evaluation_history.json."
        )
    }

    // 5. Build snapshot metadata
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
        series,
        queryHash: hashQuery(definition), // We explicitly keep the base definition hash
        modules: scopeModules,
        metrics: [...metrics],
        selectionMode,
        aggregation: aggregation ?? null,
        runsUsed: runs.map((r) => ({ id: r.id, timestamp: r.timestamp })),
        ...(options?.note ? { note: options.note.trim() } : {}),
    }

    // 6. Persist and return updated widget
    return appendSnapshot(widgetId, snapshot)
}
