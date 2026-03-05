/**
 * Evaluation History — Data Access Layer (Server-side)
 *
 * Reads data/evaluation_history.json and selects/transforms runs
 * into time-series points for the Time Series widget.
 *
 * Must only be imported in server contexts (API routes, server components)
 * because it uses Node `fs`.
 */

import { promises as fs } from "fs"
import path from "path"
import { RunSelection, TimeSeriesSeries } from "@/types/widget"

// ─── Constants ───────────────────────────────────────────────────────────────

const HISTORY_PATH = path.join(process.cwd(), "data", "evaluation_history.json")

// ─── Raw JSON shape ───────────────────────────────────────────────────────────

interface RawModuleMetric {
    precision: number | null
    recall: number | null
    tp: number
    fp: number
    fn: number
}

interface RawRunMetrics {
    precision: number | null
    recall: number | null
    tp: number
    fp: number
    fn: number
}

export interface EvaluationRun {
    id: string
    timestamp: string
    status: string
    metrics?: RawRunMetrics
    moduleMetrics?: Record<string, RawModuleMetric>
    typeModuleMetrics?: Record<string, Record<string, RawModuleMetric>>
}

// ─── File access ─────────────────────────────────────────────────────────────

let _cachedHistory: EvaluationRun[] | null = null
let _cacheTimestamp = 0
const CACHE_TTL_MS = 30_000 // 30 s — enough for dev iteration

/**
 * Load and (lightly) cache evaluation_history.json.
 * Cache is invalidated after 30 s so hot-reload picks up new runs.
 */
export async function loadEvaluationHistory(): Promise<EvaluationRun[]> {
    const now = Date.now()
    if (_cachedHistory && now - _cacheTimestamp < CACHE_TTL_MS) {
        return _cachedHistory
    }
    const raw = await fs.readFile(HISTORY_PATH, "utf-8")
    _cachedHistory = JSON.parse(raw) as EvaluationRun[]
    _cacheTimestamp = now
    return _cachedHistory
}

// ─── Run Selection ───────────────────────────────────────────────────────────

/**
 * Select runs from history according to the RunSelection DSL.
 * Runs are sorted newest-first before selection.
 * Returned array is oldest-first (good for charting left → right).
 */
export function selectRuns(history: EvaluationRun[], runSelection: RunSelection): EvaluationRun[] {
    // Filter to successful runs only (status === "success")
    const ok = history.filter((r) => r.status === "success")

    // Sort newest-first
    const sorted = [...ok].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    if (runSelection.type === "latest") {
        const count = runSelection.count > 0 ? runSelection.count : sorted.length
        // Slice N most recent, then reverse so chart goes oldest → newest
        return sorted.slice(0, count).reverse()
    }

    if (runSelection.type === "ids") {
        const ids = new Set(runSelection.runBatchIds)
        return sorted.filter((r) => ids.has(r.id)).reverse()
    }

    if (runSelection.type === "dateRange") {
        const start = new Date(runSelection.start).getTime()
        const end = new Date(runSelection.end).getTime()
        return sorted
            .filter((r) => {
                const t = new Date(r.timestamp).getTime()
                return t >= start && t <= end
            })
            .reverse()
    }

    return sorted.reverse()
}

// ─── Metric computation ───────────────────────────────────────────────────────

function safeRatio(num: number, den: number): number | null {
    return den === 0 ? null : num / den
}

/**
 * For a single run, compute precision & recall for the given scope.
 * - If `scopeModules` is non-empty → sum TP/FP/FN from those modules only
 * - If empty → use the global `metrics` field
 */
function computeRunMetrics(
    run: EvaluationRun,
    scopeModules: string[]
): Record<string, number | null> {
    if (scopeModules.length > 0 && run.moduleMetrics) {
        const relevant = scopeModules.filter((m) => run.moduleMetrics![m])
        if (relevant.length === 0) {
            return { precision: null, recall: null }
        }
        let tp = 0, fp = 0, fn = 0
        for (const mod of relevant) {
            const m = run.moduleMetrics[mod]
            if (m) { tp += m.tp; fp += m.fp; fn += m.fn }
        }
        return {
            precision: safeRatio(tp, tp + fp),
            recall: safeRatio(tp, tp + fn),
        }
    }
    if (run.metrics) {
        return {
            precision: run.metrics.precision ?? null,
            recall: run.metrics.recall ?? null,
        }
    }
    return { precision: null, recall: null }
}

/**
 * Compute per-run metric values for each run.
 * Used by the snapshot generator to build drilldownPoints.
 */
export function computeRunMetricsByRun(
    runs: EvaluationRun[],
    scopeModules: string[],
): Array<{ runId: string; timestamp: string; values: Record<string, number | null> }> {
    return runs.map((run) => ({
        runId: run.id,
        timestamp: run.timestamp,
        values: computeRunMetrics(run, scopeModules),
    }))
}

/**
 * Compute an aggregated scalar from an array of nullable numbers.
 * Strategy: "avg" (default) = mean of non-null values.
 * Returns null if all values are null.
 */
export function computeAggregatedValue(
    values: (number | null)[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _aggregation: string | null | undefined = "avg"
): { value: number | null; count: number; total: number } {
    const nonNull = values.filter((v): v is number => v !== null)
    if (nonNull.length === 0) return { value: null, count: 0, total: values.length }
    const avg = nonNull.reduce((sum, v) => sum + v, 0) / nonNull.length
    return { value: avg, count: nonNull.length, total: values.length }
}

/**
 * Build time-series series from a list of selected runs (legacy / migration helper).
 * Each run becomes one data point (x = run timestamp, y = metric value).
 */
export function computeTimeSeriesPoints(
    runs: EvaluationRun[],
    scopeModules: string[],
    metrics: string[]
): import("@/types/widget").TimeSeriesSeries[] {
    return metrics.map((metric) => ({
        label: metric,
        metric,
        points: runs.map((run) => {
            const computed = computeRunMetrics(run, scopeModules)
            return {
                x: run.timestamp,
                y: computed[metric] !== undefined ? (computed[metric] as number | null) : null,
                runId: run.id,
            }
        }),
        drilldownPoints: undefined,
    }))
}
