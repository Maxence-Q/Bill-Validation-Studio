/**
 * TimeSeriesWidget — Aggregated Line Chart with Drilldown
 *
 * Default view:
 *   One data point per snapshot (x = snapshot.createdAt, y = aggregated avg).
 *   N snapshots → N points per metric series.
 *
 * Drilldown view (click a point):
 *   Inline expanded panel shows per-run points for that snapshot.
 *
 * Backward compat:
 *   Old snapshots where points are run-level (have .runId) are migrated
 *   transparently: avg → new aggregated point, old points → drilldownPoints.
 */

"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Widget, WidgetSnapshot, TimeSeriesSeries } from "@/types/widget"
import { LineChart, Camera, RefreshCw, AlertTriangle, ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { CHART_COLORS } from "@/components/dashboard/widgets/shared/widget-helpers"
import { metricLabel, groupByLabel } from "@/components/dashboard/widgets/shared/widget-helpers"
import { generateSnapshot } from "@/lib/dashboard/widget-client"
import { AddSnapshotModal } from "./AddSnapshotModal"

// ─── Chart Constants ─────────────────────────────────────────────────────────

const PAD = { top: 20, right: 20, bottom: 40, left: 50 }
const W = 700
const H = 300
const IW = W - PAD.left - PAD.right
const IH = H - PAD.top - PAD.bottom

// Drilldown chart (smaller)
const DH = 200
const DIH = DH - PAD.top - PAD.bottom

// ─── Backward-compat migration ────────────────────────────────────────────────

/**
 * Detect old-format snapshots: series[].points contain run-level entries
 * (identified by presence of a runId field on the first point).
 * Migrate to new format in memory — does NOT write to disk.
 */
function normalizeSnapshot(snap: WidgetSnapshot): WidgetSnapshot {
    if (!snap.series || snap.series.length === 0) return snap

    const firstPoint = snap.series[0].points[0]
    // New format: aggregated point — no runId
    if (!firstPoint?.runId) return snap

    // Old format: points are run-level, need migration
    const normalizedSeries: TimeSeriesSeries[] = snap.series.map((s) => {
        const nonNull = s.points.filter((p) => p.y !== null).map((p) => p.y as number)
        const avg = nonNull.length > 0
            ? nonNull.reduce((a, b) => a + b, 0) / nonNull.length
            : null

        return {
            ...s,
            points: [{ x: snap.createdAt, y: avg }],   // aggregated point
            drilldownPoints: s.points,                   // old points → drilldown
        }
    })

    return { ...snap, series: normalizedSeries }
}

// ─── SVG helpers ─────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()}`
}

function buildSvgLines(
    series: TimeSeriesSeries[],
    points: Array<{ x: number; y: number | null; value: number | null; date: string }[]>,
    innerH: number
) {
    // Already pre-computed by caller — just pair
    return series.map((s, mi) => ({
        key: s.metric,
        color: CHART_COLORS[mi % CHART_COLORS.length],
        points: points[mi],
    }))
}

interface ChartScales {
    yMin: number
    yMax: number
    yTicks: { val: number; y: number }[]
    thresholdY: number | null
    xStep: number
    xCount: number
}

function computeScales(
    allYValues: (number | null)[],
    xCount: number,
    threshold: number | undefined,
    innerH: number
): ChartScales {
    const valid = allYValues.filter((v): v is number => v !== null)
    let yMin = valid.length > 0 ? Math.min(...valid) : 0
    let yMax = valid.length > 0 ? Math.max(...valid) : 1
    if (threshold !== undefined) {
        if (threshold < yMin) yMin = threshold
        if (threshold > yMax) yMax = threshold
    }
    const rng = yMax - yMin || 0.1
    yMin = Math.max(0, yMin - rng * 0.1)
    yMax = Math.min(1, yMax + rng * 0.1)
    const yTicks = Array.from({ length: 5 }, (_, i) => ({
        val: yMin + (i / 4) * (yMax - yMin),
        y: PAD.top + innerH - (i / 4) * innerH,
    }))
    const thresholdY = threshold !== undefined
        ? PAD.top + innerH - ((threshold - yMin) / (yMax - yMin)) * innerH
        : null
    const xStep = xCount > 1 ? IW / (xCount - 1) : IW / 2
    return { yMin, yMax, yTicks, thresholdY, xStep, xCount }
}

function toSvgX(i: number, xCount: number, xStep: number) {
    return PAD.left + (xCount > 1 ? i * xStep : IW / 2)
}

function toSvgY(val: number, yMin: number, yMax: number, innerH: number) {
    return PAD.top + innerH - ((val - yMin) / (yMax - yMin)) * innerH
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface MiniChartProps {
    series: TimeSeriesSeries[]
    /** Which series field to use: "drilldownPoints" or "points" */
    useField: "drilldownPoints" | "points"
    height?: number
    innerHeight?: number
    threshold?: number
    selectedSnapshotIdx?: number
    onPointClick?: (idx: number) => void
}

function MiniChart({
    series,
    useField,
    height = H,
    innerHeight = IH,
    threshold,
    selectedSnapshotIdx,
    onPointClick,
}: MiniChartProps) {
    const allPoints = series.flatMap((s) => {
        const pts = useField === "drilldownPoints" ? (s.drilldownPoints ?? []) : s.points
        return pts.map((p) => p.y)
    })
    const xCount = (series[0]?.[useField === "drilldownPoints" ? "drilldownPoints" : "points"] ?? []).length
    const scales = computeScales(allPoints, xCount, threshold, innerHeight)

    return (
        <svg
            viewBox={`0 0 ${W} ${height}`}
            className="w-full h-auto"
            style={{ minWidth: 320 }}
        >
            {/* Y grid + labels */}
            {scales.yTicks.map((tick, i) => (
                <g key={i}>
                    <line
                        x1={PAD.left} y1={tick.y}
                        x2={W - PAD.right} y2={tick.y}
                        className="stroke-border/30"
                        strokeWidth={1}
                        strokeDasharray={i === 0 ? undefined : "4 4"}
                    />
                    <text x={PAD.left - 8} y={tick.y + 4} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: "10px" }}>
                        {tick.val >= 0 && tick.val <= 1 ? `${(tick.val * 100).toFixed(0)}%` : tick.val.toFixed(1)}
                    </text>
                </g>
            ))}

            {/* Threshold line */}
            {scales.thresholdY !== null && (
                <g>
                    <line
                        x1={PAD.left} y1={scales.thresholdY}
                        x2={W - PAD.right} y2={scales.thresholdY}
                        stroke="hsl(160, 60%, 50%)" strokeWidth={1.5}
                        strokeDasharray="8 4" opacity={0.7}
                    />
                    <text x={W - PAD.right + 4} y={scales.thresholdY + 4} className="fill-emerald-400" style={{ fontSize: "10px" }}>Goal</text>
                </g>
            )}

            {/* X-axis labels */}
            {Array.from({ length: xCount }).map((_, i) => {
                const pts = useField === "drilldownPoints" ? (series[0]?.drilldownPoints ?? []) : series[0]?.points ?? []
                const label = pts[i] ? formatDate(pts[i].x) : ""
                const x = toSvgX(i, xCount, scales.xStep)
                return (
                    <text key={i} x={x} y={height - 8} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: "10px" }}>
                        {label}
                    </text>
                )
            })}

            {/* Series lines + points */}
            {series.map((s, mi) => {
                const pts = (useField === "drilldownPoints" ? s.drilldownPoints : s.points) ?? []
                const color = CHART_COLORS[mi % CHART_COLORS.length]

                const svgPts = pts.map((p, i) => ({
                    svgX: toSvgX(i, xCount, scales.xStep),
                    svgY: p.y !== null ? toSvgY(p.y, scales.yMin, scales.yMax, innerHeight) : null,
                    value: p.y,
                    date: p.x,
                    idx: i,
                }))

                const validPts = svgPts.filter((p) => p.svgY !== null) as typeof svgPts & { svgY: number }[]
                if (validPts.length === 0) return null

                const pathD = validPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.svgX} ${p.svgY}`).join(" ")
                const areaD = validPts.length > 1
                    ? `${pathD} L ${validPts[validPts.length - 1].svgX} ${PAD.top + innerHeight} L ${validPts[0].svgX} ${PAD.top + innerHeight} Z`
                    : null

                return (
                    <g key={s.metric}>
                        <defs>
                            <linearGradient id={`grad2-${s.metric}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                                <stop offset="100%" stopColor={color} stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {areaD && <path d={areaD} fill={`url(#grad2-${s.metric})`} />}
                        <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

                        {svgPts.map((p) => {
                            if (p.svgY === null) return null
                            const isSelected = selectedSnapshotIdx !== undefined && p.idx === selectedSnapshotIdx
                            const r = isSelected ? 6 : 4
                            return (
                                <g key={p.idx} style={{ cursor: onPointClick ? "pointer" : undefined }}
                                    onClick={() => onPointClick?.(p.idx)}>
                                    {isSelected && <circle cx={p.svgX} cy={p.svgY} r={10} fill={color} opacity={0.15} />}
                                    <circle cx={p.svgX} cy={p.svgY} r={r} fill={color}>
                                        <title>{`${metricLabel(s.metric)}: ${p.value !== null ? (p.value * 100).toFixed(1) : "—"}%  ${formatDate(p.date)}`}</title>
                                    </circle>
                                </g>
                            )
                        })}
                    </g>
                )
            })}
        </svg>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface TimeSeriesWidgetProps {
    widget: Widget
    onWidgetUpdate?: (updated: Widget) => void
}

export function TimeSeriesWidget({ widget, onWidgetUpdate }: TimeSeriesWidgetProps) {
    const [localWidget, setLocalWidget] = useState<Widget>(widget)
    const [generating, setGenerating] = useState(false)
    const [autoInitError, setAutoInitError] = useState<string | null>(null)
    const [autoInitDone, setAutoInitDone] = useState(false)
    const [selectedSnapshotIdx, setSelectedSnapshotIdx] = useState<number | null>(null)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)

    useEffect(() => { setLocalWidget(widget) }, [widget])

    // Normalize (migrate) all snapshots
    const normalizedSnapshots = useMemo(
        () => localWidget.snapshots.map(normalizeSnapshot),
        [localWidget.snapshots]
    )

    const hasSnapshots = normalizedSnapshots.length > 0
    const threshold = localWidget.definition.targetThreshold

    // ── Generate snapshot (internal helper) ───────────────────────────────────
    const doGenerate = useCallback(async (options?: { count: number; note: string }) => {
        setGenerating(true)
        try {
            const params = options
                ? {
                    overrideRunSelection: { type: "latest" as const, count: options.count },
                    note: options.note || undefined,
                }
                : undefined

            const updated = await generateSnapshot(localWidget.id, params)
            setLocalWidget(updated)
            onWidgetUpdate?.(updated)
            return updated
        } finally {
            setGenerating(false)
        }
    }, [localWidget.id, onWidgetUpdate])

    useEffect(() => {
        if (autoInitDone || hasSnapshots) { setAutoInitDone(true); return }
        setAutoInitDone(true)
        doGenerate().catch((err: Error) => setAutoInitError(err.message))
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Handler for the modal submission
    const handleAddSnapshotSubmit = async (data: { count: number; note: string }) => {
        try {
            await doGenerate(data)
            toast.success("Snapshot added", { description: "New aggregated data point captured." })
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to generate snapshot"
            toast.error("Snapshot failed", { description: msg })
            throw err // Let the modal know it failed
        }
    }

    // ── Build main chart series (one point per snapshot per metric) ───────────
    const mainSeries: TimeSeriesSeries[] = useMemo(() => {
        if (!hasSnapshots) return []
        const metricKeys = localWidget.definition.query.metrics

        return metricKeys.map((metric) => ({
            label: metric,
            metric,
            points: normalizedSnapshots.map((snap) => {
                const s = snap.series?.find((s) => s.metric === metric)
                const pt = s?.points[0]
                return { x: snap.createdAt, y: pt?.y ?? null }
            }),
        }))
    }, [normalizedSnapshots, localWidget.definition.query.metrics, hasSnapshots])

    const hasData = mainSeries.some((s) => s.points.some((p) => p.y !== null))

    // ── Drilldown data for selected snapshot ──────────────────────────────────
    const drilldownSnap = selectedSnapshotIdx !== null
        ? normalizedSnapshots[selectedSnapshotIdx] ?? null
        : null

    const drilldownSeries: TimeSeriesSeries[] | null = useMemo(() => {
        if (!drilldownSnap?.series) return null
        return drilldownSnap.series.map((s) => ({
            ...s,
            points: s.drilldownPoints ?? [],
        }))
    }, [drilldownSnap])

    const hasDrilldown = drilldownSeries && drilldownSeries.some((s) => s.points.length > 0)

    const groupByName = localWidget.definition.query.groupBy

    return (
        <section className="scroll-mt-20">
            {/* Panel identifier */}
            <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-border/40" />
                <span className="text-xs font-mono font-medium text-muted-foreground/60 tracking-widest uppercase px-2">time series</span>
                <div className="h-px flex-1 bg-border/40" />
            </div>

            {/* Main card */}
            <div className="relative rounded-2xl border border-border/50 overflow-hidden bg-card/50 backdrop-blur-sm shadow-2xl shadow-black/20">
                <div className="h-1 w-full bg-gradient-to-r from-violet-500/80 via-violet-400 to-violet-500/40" />
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-96 bg-violet-500/6 rounded-full blur-3xl pointer-events-none" />

                <div className="relative p-6 space-y-6">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <LineChart className="h-5 w-5 text-violet-400" />
                                <h2 className="text-xl font-bold tracking-tight">{localWidget.name}</h2>
                            </div>
                            {localWidget.description && (
                                <p className="text-sm text-muted-foreground">{localWidget.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/60">
                                <span>{localWidget.definition.query.metrics.map(metricLabel).join(", ")}</span>
                                <span>·</span>
                                <span>{groupByLabel(groupByName)}</span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1">
                                    <Camera className="h-3 w-3" />
                                    {normalizedSnapshots.length} snapshot{normalizedSnapshots.length !== 1 ? "s" : ""}
                                </span>
                                {drilldownSnap?.runsUsed && (
                                    <>
                                        <span>·</span>
                                        <span>{drilldownSnap.runsUsed.length} runs/snapshot</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsAddModalOpen(true)}
                            disabled={generating}
                            className="shrink-0 gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 hover:border-violet-500/50"
                        >
                            {generating ? (
                                <><RefreshCw className="h-3.5 w-3.5 animate-spin" /><span>Generating…</span></>
                            ) : (
                                <><Camera className="h-3.5 w-3.5" /><span>Add Snapshot</span></>
                            )}
                        </Button>
                    </div>

                    {/* Generating spinner (auto-init) */}
                    {generating && !hasData && (
                        <div className="text-center py-12">
                            <RefreshCw className="h-8 w-8 mx-auto mb-3 text-violet-400 animate-spin" />
                            <p className="text-sm text-muted-foreground font-medium">Generating initial snapshot…</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Reading evaluation history and computing metrics</p>
                        </div>
                    )}

                    {/* Error state */}
                    {!generating && autoInitError && !hasData && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
                            <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-amber-400" />
                            <p className="text-sm text-amber-300 font-medium">No data available</p>
                            <p className="text-xs text-muted-foreground/70 mt-2 max-w-sm mx-auto">{autoInitError}</p>
                            <Button size="sm" variant="outline" onClick={() => setIsAddModalOpen(true)}
                                className="mt-4 gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                                <RefreshCw className="h-3.5 w-3.5" /> Retry
                            </Button>
                        </div>
                    )}

                    {/* Main chart — aggregated view */}
                    {!generating && hasData && (
                        <div className="space-y-3">
                            <div className="rounded-xl border border-border/40 bg-background/40 p-4 overflow-x-auto">
                                <p className="text-[10px] text-muted-foreground/50 mb-2 uppercase tracking-widest font-mono">
                                    click a point to expand run details
                                </p>
                                <MiniChart
                                    series={mainSeries}
                                    useField="points"
                                    height={H}
                                    innerHeight={IH}
                                    threshold={threshold}
                                    selectedSnapshotIdx={selectedSnapshotIdx ?? undefined}
                                    onPointClick={(idx) =>
                                        setSelectedSnapshotIdx((prev) => (prev === idx ? null : idx))
                                    }
                                />
                            </div>

                            {/* Legend */}
                            <div className="flex flex-wrap items-center gap-4 px-1">
                                {mainSeries.map((s, mi) => (
                                    <div key={s.metric} className="flex items-center gap-1.5">
                                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[mi % CHART_COLORS.length] }} />
                                        <span className="text-xs font-medium text-muted-foreground">{metricLabel(s.metric)}</span>
                                    </div>
                                ))}
                                {threshold !== undefined && (
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-0.5 w-4 bg-emerald-400 rounded" />
                                        <span className="text-xs font-medium text-muted-foreground">Target ({(threshold * 100).toFixed(0)}%)</span>
                                    </div>
                                )}
                                {normalizedSnapshots[normalizedSnapshots.length - 1]?.selectionMode && (
                                    <span className="ml-auto text-xs text-muted-foreground/40">
                                        {normalizedSnapshots[normalizedSnapshots.length - 1].selectionMode}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {!generating && !autoInitError && !hasData && (
                        <div className="text-center py-16">
                            <LineChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                            <p className="text-sm text-muted-foreground font-medium">No data yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm mx-auto">
                                Click <strong>Add Snapshot</strong> to capture the current state from evaluation history.
                            </p>
                        </div>
                    )}

                    {/* ── Drilldown panel ── */}
                    {selectedSnapshotIdx !== null && drilldownSnap && (
                        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
                            {/* Drilldown header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-violet-500/15">
                                <div className="flex items-center gap-2">
                                    <ChevronDown className="h-4 w-4 text-violet-400" />
                                    <span className="text-sm font-semibold text-violet-300">
                                        Snapshot #{selectedSnapshotIdx + 1} — Run breakdown
                                    </span>
                                    <span className="text-xs text-muted-foreground/60">
                                        {new Date(drilldownSnap.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                    {drilldownSnap.selectionMode && (
                                        <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
                                            {drilldownSnap.selectionMode}
                                        </span>
                                    )}
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                    onClick={() => setSelectedSnapshotIdx(null)}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>

                            <div className="p-4 space-y-4">
                                {/* Note */}
                                {drilldownSnap.note && (
                                    <div className="text-sm text-foreground/90 bg-background/40 border border-border/30 rounded-lg p-3 whitespace-pre-wrap">
                                        {drilldownSnap.note}
                                    </div>
                                )}

                                {/* Drilldown chart */}
                                {hasDrilldown && drilldownSeries ? (
                                    <div className="rounded-lg border border-border/30 bg-background/30 p-3 overflow-x-auto">
                                        <MiniChart
                                            series={drilldownSeries}
                                            useField="points"
                                            height={DH}
                                            innerHeight={DIH}
                                            threshold={threshold}
                                        />
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground/60 text-center py-4">
                                        No run-level data stored for this snapshot.
                                    </p>
                                )}

                                {/* Aggregated values summary */}
                                {drilldownSnap.series && (
                                    <div className="flex flex-wrap gap-3">
                                        {drilldownSnap.series.map((s, mi) => {
                                            const aggVal = s.points[0]?.y
                                            const nonNull = (s.drilldownPoints ?? []).filter(p => p.y !== null).length
                                            return (
                                                <div key={s.metric} className="flex items-center gap-2 rounded-lg border border-border/30 bg-background/30 px-3 py-2">
                                                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[mi % CHART_COLORS.length] }} />
                                                    <span className="text-xs font-medium text-muted-foreground">{metricLabel(s.metric)}</span>
                                                    <span className="text-sm font-bold">
                                                        {aggVal !== null && aggVal !== undefined
                                                            ? `${(aggVal * 100).toFixed(1)}%`
                                                            : "—"}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground/50">
                                                        avg of {nonNull} run{nonNull !== 1 ? "s" : ""}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Runs used */}
                                {drilldownSnap.runsUsed && drilldownSnap.runsUsed.length > 0 && (
                                    <div>
                                        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest font-mono mb-2">Runs used</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {drilldownSnap.runsUsed.map((r, i) => (
                                                <span key={r.id} className="inline-flex items-center gap-1 text-[10px] font-mono bg-background/50 border border-border/30 rounded px-2 py-0.5 text-muted-foreground/70">
                                                    <span className="text-muted-foreground/40">#{i + 1}</span>
                                                    {r.id.slice(0, 8)}…
                                                    <span className="text-muted-foreground/40">{formatDate(r.timestamp)}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <AddSnapshotModal
                open={isAddModalOpen}
                onOpenChange={setIsAddModalOpen}
                defaultCount={
                    localWidget.definition.query.runSelection.type === "latest"
                        ? localWidget.definition.query.runSelection.count
                        : 5
                }
                onSubmit={handleAddSnapshotSubmit}
            />
        </section>
    )
}
