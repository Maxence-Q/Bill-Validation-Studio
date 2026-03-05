/**
 * Widget Types
 *
 * TypeScript types matching the schema documented in WIDGET_STORAGE.md.
 * Source of truth: src/components/dashboard/WIDGET_STORAGE.md
 */

// ─── Widget Type Enum ────────────────────────────────────────────────────────

export type WidgetType =
    | "default_panel"
    | "time_series"
    | "histogram"
    | "distribution"
    | "main_kpi"
    | "breakdown_table"
    | "score_heatmap"

// ─── Shared Query DSL ────────────────────────────────────────────────────────

export interface RunSelectionById {
    type: "ids"
    runBatchIds: string[]
}

export interface RunSelectionByLatest {
    type: "latest"
    count: number
}

export interface RunSelectionByDateRange {
    type: "dateRange"
    start: string
    end: string
}

export type RunSelection = RunSelectionById | RunSelectionByLatest | RunSelectionByDateRange

export interface QueryScope {
    modules: string[]
    perturbationTypes: string[]
}

export type GroupBy = "module" | "perturbation_type" | null
export type Aggregation = "sum" | "avg" | "median" | "weighted_by_events" | null

export interface WidgetQuery {
    runSelection: RunSelection
    scope: QueryScope
    metrics: string[]
    groupBy: GroupBy
    aggregation: Aggregation
}

// ─── Widget Definition ───────────────────────────────────────────────────────

export interface WidgetDefinition {
    query: WidgetQuery
    /** Time Series: optional target line */
    targetThreshold?: number
    /** Histogram: output ordering */
    sortBy?: "value_desc" | "value_asc" | "alphabetical"
    /** Distribution: threshold to group tiny slices */
    minSlicePercent?: number
    /** Main KPI: baseline comparison run */
    compareWithRunBatchId?: string
    /** Breakdown Table: hidden columns */
    hiddenColumns?: string[]
    /** Breakdown Table: default sort */
    defaultSort?: { column: string; direction: "asc" | "desc" }
    /** Score Heatmap: Y-axis dimension */
    yAxis?: "modules" | "perturbation_types"
    /** Score Heatmap: X-axis definition */
    xAxis?: { type: "runs"; runIds: string[] } | { type: "time"; start: string; end: string; bucket: string }
    /** Score Heatmap: cell aggregation */
    cellAggregation?: "average" | "min" | "last_value"
}

// ─── Time Series Snapshot types ──────────────────────────────────────────────

export interface TimeSeriesPoint {
    /** ISO timestamp (run timestamp for drilldown, snapshot.createdAt for aggregated) */
    x: string
    /** Metric value in [0, 1] range, or null if data unavailable */
    y: number | null
    /** Run ID — present on drilldown points, absent on aggregated points */
    runId?: string
}

export interface TimeSeriesSeries {
    /** Display label (e.g. "precision", "recall") */
    label: string
    /** Raw metric key */
    metric: string
    /**
     * Aggregated points — exactly 1 per snapshot.
     * x = snapshot.createdAt, y = avg over selected runs.
     * These are what the main chart renders across N snapshots.
     */
    points: TimeSeriesPoint[]
    /**
     * Run-level drilldown points — one entry per run used to compute the aggregated value.
     * x = run.timestamp, y = per-run metric value, runId = run id.
     * Rendered in the expansion panel when a snapshot point is clicked.
     */
    drilldownPoints?: TimeSeriesPoint[]
}

// ─── Widget Snapshot ─────────────────────────────────────────────────────────

export interface WidgetSnapshot {
    snapshotId: string
    createdAt: string
    runSelection?: RunSelection
    /** Time Series / Main KPI — legacy scalar per-snapshot metric */
    metricsComputed?: Record<string, number>
    /** Time Series — new multi-run series data */
    series?: TimeSeriesSeries[]
    /** Time Series — query fingerprint for cache invalidation */
    queryHash?: string
    /** Time Series — modules scope at snapshot time */
    modules?: string[]
    /** Time Series — metrics keys at snapshot time */
    metrics?: string[]
    /** Time Series — run selection mode label */
    selectionMode?: string
    /** Time Series — runs included in this snapshot */
    runsUsed?: { id: string; timestamp: string }[]
    /** Time Series — aggregation method used (e.g. "avg", or null = no explicit aggregation) */
    aggregation?: string | null
    /** Time Series — optional user note added at creation time */
    note?: string
    /** Histogram */
    bars?: Array<{ category: string; value: number }>
    /** Distribution */
    slices?: Array<{ category: string; value: number; percent: number }>
    /** Breakdown Table */
    rows?: Array<Record<string, string | number>>
    /** Score Heatmap */
    cells?: Array<{ row: string; col: string; value: number }>
    /** Shared */
    rawCounters?: Record<string, number> | Record<string, Record<string, number>>
    progressSinceLast?: Record<string, string>
    deltaFromBaseline?: Record<string, string>
}

// ─── Full Widget (on-disk shape) ─────────────────────────────────────────────

export interface Widget {
    id: string
    type: WidgetType
    name: string
    createdAt: string
    updatedAt: string
    isRemovable: boolean
    description?: string
    author?: string
    layout?: { x: number; y: number; w: number; h: number }
    definition: WidgetDefinition
    snapshots: WidgetSnapshot[]
}

// ─── Lightweight summary (for listing / modal) ──────────────────────────────

export interface WidgetSummary {
    id: string
    type: WidgetType
    name: string
    createdAt: string
    updatedAt: string
    description?: string
    isRemovable: boolean
    snapshotCount: number
}
