/**
 * Unit tests for evaluationHistory.ts — runnable with `npx tsx`:
 *
 *   npx tsx src/lib/dashboard/__tests__/evaluationHistory.test.ts
 *
 * Covers: selectRuns(), computeTimeSeriesPoints(), computeAggregatedValue(),
 *         migration detection logic.
 */

import {
    selectRuns,
    computeTimeSeriesPoints,
    computeAggregatedValue,
    computeRunMetricsByRun,
    EvaluationRun,
} from "../evaluationHistory"
import type { TimeSeriesPoint } from "@/types/widget"

// ─── Mock data ────────────────────────────────────────────────────────────────

const RUNS: EvaluationRun[] = [
    {
        id: "run-1",
        timestamp: "2026-02-20T10:00:00.000Z",
        status: "success",
        metrics: { precision: 0.8, recall: 0.75, tp: 40, fp: 10, fn: 15 },
        moduleMetrics: {
            ModuleA: { precision: 0.9, recall: 0.7, tp: 9, fp: 1, fn: 4 },
            ModuleB: { precision: 0.7, recall: 0.8, tp: 14, fp: 6, fn: 4 },
        },
    },
    {
        id: "run-2",
        timestamp: "2026-02-21T10:00:00.000Z",
        status: "success",
        metrics: { precision: 0.85, recall: 0.80, tp: 68, fp: 12, fn: 17 },
        moduleMetrics: {
            ModuleA: { precision: 0.95, recall: 0.75, tp: 19, fp: 1, fn: 6 },
            ModuleB: { precision: 0.75, recall: 0.85, tp: 17, fp: 6, fn: 3 },
        },
    },
    {
        id: "run-3",
        timestamp: "2026-02-22T10:00:00.000Z",
        status: "success",
        metrics: { precision: 0.9, recall: 0.88, tp: 88, fp: 10, fn: 12 },
        moduleMetrics: {
            ModuleA: { precision: 0.95, recall: 0.9, tp: 19, fp: 1, fn: 2 },
            ModuleC: { precision: 0.88, recall: 0.85, tp: 22, fp: 3, fn: 4 },
        },
    },
    {
        id: "run-4",
        timestamp: "2026-02-23T10:00:00.000Z",
        status: "failed",
    },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`  ✓ ${message}`)
        passed++
    } else {
        console.error(`  ✗ FAIL: ${message}`)
        failed++
    }
}

function assertClose(a: number | null | undefined, b: number, message: string, tol = 0.001) {
    const ok = a !== null && a !== undefined && Math.abs(a - b) < tol
    assert(ok, `${message} (got ${a?.toFixed(4)}, expected ~${b.toFixed(4)})`)
}

// ─── Test: selectRuns ─────────────────────────────────────────────────────────

console.log("\n=== selectRuns ===")

{
    const selected = selectRuns(RUNS, { type: "latest", count: 2 })
    assert(selected.length === 2, "latest 2 returns 2 runs")
    assert(selected[0].id === "run-2", "oldest of latest 2 comes first (chart left)")
    assert(selected[1].id === "run-3", "newest of latest 2 comes last (chart right)")
}

{
    const selected = selectRuns(RUNS, { type: "latest", count: 0 })
    assert(selected.length === 3, "latest count=0 returns all successful runs")
}

{
    const selected = selectRuns(RUNS, { type: "ids", runBatchIds: ["run-1", "run-3"] })
    assert(selected.length === 2, "ids selection returns correct count")
    assert(selected[0].id === "run-1" && selected[1].id === "run-3", "ids are in chronological order")
}

{
    const selected = selectRuns(RUNS, { type: "dateRange", start: "2026-02-21T00:00:00Z", end: "2026-02-22T23:59:59Z" })
    assert(selected.length === 2, "dateRange returns 2 runs")
    assert(selected[0].id === "run-2", "dateRange oldest = run-2")
}

{
    const all = selectRuns(RUNS, { type: "latest", count: 100 })
    assert(!all.some(r => r.id === "run-4"), "failed run is excluded")
}

// ─── Test: computeTimeSeriesPoints (legacy) ──────────────────────────────────

console.log("\n=== computeTimeSeriesPoints (legacy) ===")

{
    const runs = selectRuns(RUNS, { type: "latest", count: 3 })
    const series = computeTimeSeriesPoints(runs, [], ["precision", "recall"])
    assert(series.length === 2, "global scope: 2 series")
    const prec = series.find(s => s.metric === "precision")!
    assert(prec.points.length === 3, "3 points for 3 runs")
    assertClose(prec.points[0].y, 0.8, "run-1 global precision = 0.8")
    assertClose(prec.points[2].y, 0.9, "run-3 global precision = 0.9")
}

{
    const runs = selectRuns(RUNS, { type: "latest", count: 3 })
    const series = computeTimeSeriesPoints(runs, ["ModuleB"], ["precision"])
    const prec = series[0]
    assert(prec.points[0].y !== null, "run-1 ModuleB precision non-null")
    assert(prec.points[2].y === null, "run-3 ModuleB precision is null (absent)")
}

// ─── Test: computeRunMetricsByRun ────────────────────────────────────────────

console.log("\n=== computeRunMetricsByRun ===")

{
    const runs = selectRuns(RUNS, { type: "latest", count: 2 })
    const perRun = computeRunMetricsByRun(runs, ["ModuleA"])
    assert(perRun.length === 2, "2 run records for 2 runs")
    assert(perRun[0].runId === "run-2", "first run is run-2 (oldest of latest 2)")
    assertClose(perRun[0].values["precision"], 19 / 20, "run-2 ModuleA precision = 0.95")
}

// ─── Test: computeAggregatedValue ────────────────────────────────────────────

console.log("\n=== computeAggregatedValue ===")

{
    const r = computeAggregatedValue([0.8, 0.9, 0.7])
    assertClose(r.value, 0.8, "avg of [0.8, 0.9, 0.7] = 0.8")
    assert(r.count === 3, "all 3 values counted")
    assert(r.total === 3, "total = 3")
}

{
    const r = computeAggregatedValue([0.6, null, 0.8, null])
    assertClose(r.value, 0.7, "avg ignores nulls: [0.6, 0.8] → 0.7")
    assert(r.count === 2, "count = 2 (non-null)")
    assert(r.total === 4, "total = 4")
}

{
    const r = computeAggregatedValue([null, null])
    assert(r.value === null, "all-null → value is null")
    assert(r.count === 0, "count = 0")
}

{
    const r = computeAggregatedValue([])
    assert(r.value === null, "empty array → value is null")
}

// ─── Test: migration detection ───────────────────────────────────────────────
// We inline the same detection logic used in TimeSeriesWidget

console.log("\n=== Migration detection ===")

function isOldFormat(snap: { series?: Array<{ points: TimeSeriesPoint[] }> }): boolean {
    return !!snap.series?.[0]?.points?.[0]?.runId
}

function migrateSnapshot(snap: { createdAt: string; series?: Array<{ metric: string; label: string; points: TimeSeriesPoint[] }> }) {
    if (!snap.series) return snap
    return {
        ...snap,
        series: snap.series.map(s => {
            const nonNull = s.points.filter(p => p.y !== null).map(p => p.y as number)
            const avg = nonNull.length > 0 ? nonNull.reduce((a, b) => a + b, 0) / nonNull.length : null
            return {
                ...s,
                points: [{ x: snap.createdAt, y: avg }],
                drilldownPoints: s.points,
            }
        }),
    }
}

{
    const oldSnap = {
        createdAt: "2026-02-27T10:00:00Z",
        series: [{
            label: "precision", metric: "precision",
            points: [
                { x: "2026-02-26T10:00:00Z", y: 0.6, runId: "run-a" },
                { x: "2026-02-26T11:00:00Z", y: 0.8, runId: "run-b" },
            ],
        }],
    }

    assert(isOldFormat(oldSnap), "old format detected (has runId on points)")
    const migrated = migrateSnapshot(oldSnap)
    assert(migrated.series![0].points.length === 1, "migrated: 1 aggregated point")
    assertClose(migrated.series![0].points[0].y, 0.7, "migrated: avg(0.6, 0.8) = 0.7")
    assert(migrated.series![0].points[0].x === oldSnap.createdAt, "migrated: x = snapshot.createdAt")
    assert((migrated.series![0] as { drilldownPoints?: unknown[] }).drilldownPoints?.length === 2, "migrated: 2 drilldown points")
}

{
    const newSnap = {
        createdAt: "2026-02-27T10:00:00Z",
        series: [{
            label: "precision", metric: "precision",
            points: [{ x: "2026-02-27T10:00:00Z", y: 0.75 }],  // no runId
        }],
    }
    assert(!isOldFormat(newSnap), "new format NOT detected as old (no runId)")
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
