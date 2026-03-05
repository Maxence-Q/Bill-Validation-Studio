/**
 * DistributionWidget — Pie/Donut Chart Renderer
 *
 * Renders the latest snapshot's `slices[]` as an animated SVG donut chart.
 * Shows an empty state when no snapshots exist yet.
 */

"use client"

import { useMemo, useState } from "react"
import { Widget } from "@/types/widget"
import { PieChart, Camera } from "lucide-react"
import { CHART_COLORS } from "@/components/dashboard/widgets/shared/widget-helpers"
import { metricLabel, groupByLabel } from "@/components/dashboard/widgets/shared/widget-helpers"
import { Button } from "@/components/ui/button"
import { generateSnapshot } from "@/lib/dashboard/widget-client"
import { AddDistributionSnapshotModal } from "./AddSnapshotModal"

// ─── SVG helpers ─────────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
    // Handle full circle case
    if (endAngle - startAngle >= 359.99) {
        const mid = startAngle + 180
        const s1 = polarToCartesian(cx, cy, r, startAngle)
        const m = polarToCartesian(cx, cy, r, mid)
        const s2 = polarToCartesian(cx, cy, r, endAngle - 0.01)
        return [
            `M ${s1.x} ${s1.y}`,
            `A ${r} ${r} 0 0 1 ${m.x} ${m.y}`,
            `A ${r} ${r} 0 0 1 ${s2.x} ${s2.y}`,
        ].join(" ")
    }
    const start = polarToCartesian(cx, cy, r, endAngle)
    const end = polarToCartesian(cx, cy, r, startAngle)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

// ─── Component ───────────────────────────────────────────────────────────────

interface DistributionWidgetProps {
    widget: Widget
    onWidgetUpdate?: (widget: Widget) => void
}

export function DistributionWidget({ widget, onWidgetUpdate }: DistributionWidgetProps) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)

    const latestSnapshot = widget.snapshots.length > 0
        ? widget.snapshots[widget.snapshots.length - 1]
        : null

    const slices = latestSnapshot?.slices ?? []
    const hasData = slices.length > 0

    // Calculate arc angles
    const arcs = useMemo(() => {
        if (!hasData) return []
        let cumAngle = 0
        return slices.map((slice, i) => {
            const angle = slice.percent * 360
            const startAngle = cumAngle
            cumAngle += angle
            return {
                ...slice,
                startAngle,
                endAngle: cumAngle,
                color: CHART_COLORS[i % CHART_COLORS.length],
            }
        })
    }, [slices, hasData])

    const metricName = widget.definition.query.metrics[0]
    const groupByName = widget.definition.query.groupBy

    const defaultCount = widget.definition.query.runSelection.type === "latest"
        ? widget.definition.query.runSelection.count
        : 10

    const handleAddSnapshot = async (data: { count: number; note: string }) => {
        const updatedWidget = await generateSnapshot(widget.id, {
            overrideRunSelection: { type: "latest", count: data.count },
            note: data.note,
        })
        if (onWidgetUpdate) {
            onWidgetUpdate(updatedWidget)
        }
    }

    return (
        <section className="scroll-mt-20">
            {/* Panel identifier */}
            <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-border/40" />
                <span className="text-xs font-mono font-medium text-muted-foreground/60 tracking-widest uppercase px-2">
                    distribution
                </span>
                <div className="h-px flex-1 bg-border/40" />
            </div>

            {/* Main card */}
            <div className="relative rounded-2xl border border-border/50 overflow-hidden bg-card/50 backdrop-blur-sm shadow-2xl shadow-black/20">
                {/* Gradient accent */}
                <div className="h-1 w-full bg-gradient-to-r from-rose-500/80 via-rose-400 to-rose-500/40" />

                {/* Ambient glow */}
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-96 bg-rose-500/6 rounded-full blur-3xl pointer-events-none" />

                <div className="relative p-6 space-y-6">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <PieChart className="h-5 w-5 text-rose-400" />
                                <h2 className="text-xl font-bold tracking-tight">{widget.name}</h2>
                            </div>
                            {widget.description && (
                                <p className="text-sm text-muted-foreground">{widget.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/60">
                                <span>{metricLabel(metricName ?? "precision")}</span>
                                <span>·</span>
                                <span>{groupByLabel(groupByName)}</span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1">
                                    <Camera className="h-3 w-3" />
                                    {widget.snapshots.length} snapshot{widget.snapshots.length !== 1 ? "s" : ""}
                                </span>
                            </div>
                        </div>

                        {/* Top-right actions */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsAddModalOpen(true)}
                                className="h-8 gap-1.5 border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-500"
                            >
                                <Camera className="h-3.5 w-3.5 border-dashed" />
                                Add Snapshot
                            </Button>
                        </div>
                    </div>

                    {/* Chart */}
                    {hasData ? (
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            {/* SVG Donut */}
                            <div className="relative w-64 h-64 shrink-0">
                                <svg viewBox="0 0 200 200" className="w-full h-full">
                                    {arcs.map((arc, i) => {
                                        const outerR = 85
                                        const innerR = 55
                                        // Draw donut segments as thick arcs
                                        const outerPath = describeArc(100, 100, outerR, arc.startAngle, arc.endAngle)
                                        const innerPath = describeArc(100, 100, innerR, arc.startAngle, arc.endAngle)
                                        // Build closed donut segment path
                                        const outerStart = polarToCartesian(100, 100, outerR, arc.endAngle)
                                        const outerEnd = polarToCartesian(100, 100, outerR, arc.startAngle)
                                        const innerStart = polarToCartesian(100, 100, innerR, arc.startAngle)
                                        const innerEnd = polarToCartesian(100, 100, innerR, arc.endAngle)
                                        const largeArc = (arc.endAngle - arc.startAngle) > 180 ? 1 : 0

                                        const d = [
                                            `M ${outerStart.x} ${outerStart.y}`,
                                            `A ${outerR} ${outerR} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
                                            `L ${innerStart.x} ${innerStart.y}`,
                                            `A ${innerR} ${innerR} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y}`,
                                            `Z`,
                                        ].join(" ")

                                        return (
                                            <path
                                                key={i}
                                                d={d}
                                                fill={arc.color}
                                                className="transition-opacity duration-200 hover:opacity-80"
                                                style={{ opacity: 0.85 }}
                                            >
                                                <title>{`${arc.category}: ${arc.value} (${(arc.percent * 100).toFixed(1)}%)`}</title>
                                            </path>
                                        )
                                    })}
                                    {/* Center text */}
                                    <text x="100" y="96" textAnchor="middle" className="fill-foreground text-xl font-bold" style={{ fontSize: "20px" }}>
                                        {slices.reduce((sum, s) => sum + s.value, 0).toLocaleString()}
                                    </text>
                                    <text x="100" y="114" textAnchor="middle" className="fill-muted-foreground text-xs" style={{ fontSize: "11px" }}>
                                        total
                                    </text>
                                </svg>
                            </div>

                            {/* Legend */}
                            <div className="flex flex-col gap-2 flex-1 min-w-0">
                                {arcs.map((arc, i) => (
                                    <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-background/40 transition-colors">
                                        <div
                                            className="h-3 w-3 rounded-full shrink-0"
                                            style={{ backgroundColor: arc.color }}
                                        />
                                        <span className="text-sm font-medium truncate flex-1">{arc.category}</span>
                                        <span className="text-sm tabular-nums text-muted-foreground">{arc.value}</span>
                                        <span className="text-xs tabular-nums text-muted-foreground/60 w-12 text-right">
                                            {(arc.percent * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Empty state */
                        <div className="text-center py-16">
                            <PieChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
                            <p className="text-sm text-muted-foreground font-medium">No data yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm mx-auto">
                                Create a new state to populate this Distribution widget with data from your evaluation runs.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Snapshot Modal */}
            <AddDistributionSnapshotModal
                open={isAddModalOpen}
                onOpenChange={setIsAddModalOpen}
                defaultCount={defaultCount}
                onSubmit={handleAddSnapshot}
            />
        </section>
    )
}
