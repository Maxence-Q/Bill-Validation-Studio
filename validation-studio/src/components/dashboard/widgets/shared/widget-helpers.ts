/**
 * Widget Helpers — Shared Constants & Factories
 *
 * Used by creation wizards and renderers. Contains domain constants
 * (modules, metrics, perturbation types) and query builder helpers.
 */

import { WidgetQuery, WidgetDefinition, RunSelection, GroupBy, Aggregation } from "@/types/widget"

// ─── Domain constants ────────────────────────────────────────────────────────

/** The validation modules tracked by the system */
export const MODULES = [
    "Event",
    "EventDates",
    "OwnerPOS",
    "FeeDefinitions",
    "Prices",
    "PriceGroups",
    "RightToSellAndFees",
] as const

/** Perturbation types available for analysis */
export const PERTURBATION_TYPES = [
    "id",
    "string",
    "int",
    "date",
    "float",
] as const

/** Available metrics for selection */
export const METRIC_OPTIONS = [
    { value: "precision", label: "Precision" },
    { value: "recall", label: "Recall" },
    { value: "f1", label: "F1 Score" },
    { value: "false_positives", label: "False Positives (FP)" },
    { value: "false_negatives", label: "False Negatives (FN)" },
    { value: "true_positives", label: "True Positives (TP)" },
] as const

/** GroupBy options */
export const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
    { value: "module", label: "By Module" },
    { value: "perturbation_type", label: "By Perturbation Type" },
]

/** Aggregation options */
export const AGGREGATION_OPTIONS: { value: Aggregation; label: string }[] = [
    { value: null, label: "None" },
    { value: "sum", label: "Sum" },
    { value: "avg", label: "Average" },
    { value: "median", label: "Median" },
    { value: "weighted_by_events", label: "Weighted by Events" },
]

/** Run selection presets */
export const RUN_SELECTION_PRESETS = [
    { value: "latest_5", label: "Latest 5 runs", selection: { type: "latest" as const, count: 5 } },
    { value: "latest_10", label: "Latest 10 runs", selection: { type: "latest" as const, count: 10 } },
    { value: "all", label: "All runs", selection: { type: "latest" as const, count: 0 } },
] as const

// ─── Factories ───────────────────────────────────────────────────────────────

/** Build a default query with sensible defaults */
export function buildDefaultQuery(overrides?: Partial<WidgetQuery>): WidgetQuery {
    return {
        runSelection: { type: "latest", count: 0 },
        scope: { modules: [], perturbationTypes: [] },
        metrics: ["precision", "recall"],
        groupBy: null,
        aggregation: null,
        ...overrides,
    }
}

/** Build a default definition wrapping a query */
export function buildDefaultDefinition(queryOverrides?: Partial<WidgetQuery>): WidgetDefinition {
    return {
        query: buildDefaultQuery(queryOverrides),
    }
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/** Format a metric value as a percentage string */
export function formatMetricValue(value: number | null | undefined): string {
    if (value === null || value === undefined) return "—"
    // If value is between 0 and 1, treat as ratio
    if (value >= 0 && value <= 1) return `${(value * 100).toFixed(1)}%`
    // Otherwise treat as raw count
    return value.toLocaleString()
}

/** Get a human-readable label for a metric key */
export function metricLabel(key: string): string {
    const found = METRIC_OPTIONS.find((m) => m.value === key)
    return found?.label ?? key
}

/** Get a human-readable label for a groupBy value */
export function groupByLabel(value: GroupBy): string {
    if (!value) return "Global (no grouping)"
    const found = GROUP_BY_OPTIONS.find((o) => o.value === value)
    return found?.label ?? value
}

/** Get a human-readable label for an aggregation value */
export function aggregationLabel(value: Aggregation): string {
    const found = AGGREGATION_OPTIONS.find((o) => o.value === value)
    return found?.label ?? "None"
}

/** Get a human-readable label for run selection */
export function runSelectionLabel(sel: RunSelection): string {
    if (sel.type === "latest") {
        return sel.count === 0 ? "All runs" : `Latest ${sel.count} runs`
    }
    if (sel.type === "ids") {
        return `${sel.runBatchIds.length} specific run(s)`
    }
    if (sel.type === "dateRange") {
        return `${sel.start} → ${sel.end}`
    }
    return "Unknown"
}

// ─── Color palettes ──────────────────────────────────────────────────────────

/** Vibrant color palette for chart segments/lines */
export const CHART_COLORS = [
    "hsl(262, 83%, 68%)",   // violet
    "hsl(199, 89%, 58%)",   // sky
    "hsl(160, 60%, 50%)",   // emerald
    "hsl(38, 92%, 60%)",    // amber
    "hsl(350, 78%, 62%)",   // rose
    "hsl(190, 80%, 50%)",   // cyan
    "hsl(280, 65%, 60%)",   // purple
    "hsl(24, 95%, 58%)",    // orange
] as const

/** Tailwind-compatible classes for chart colors */
export const CHART_COLOR_CLASSES = [
    "text-violet-400",
    "text-sky-400",
    "text-emerald-400",
    "text-amber-400",
    "text-rose-400",
    "text-cyan-400",
    "text-purple-400",
    "text-orange-400",
] as const
