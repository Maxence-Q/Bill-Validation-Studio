/**
 * DefaultPanel Component
 * 
 * The main dashboard view that displays performance metrics (Precision & Recall)
 * for evaluation runs. It provides filtering by date range and specific run 
 * selection, and visualizes data at both a global and per-module level.
 */

"use client"

import { useState, useMemo } from "react"
import { DashboardRun } from "@/app/api/dashboard/route"
import { computeDashboardMetrics, filterRunsByDate, AggregatedMetric } from "@/lib/dashboard/metrics"
import { RunSelectorDialog } from "./run-selector-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    CalendarDays,
    Layers,
    ListFilter,
    TrendingUp,
    Activity,
    Calendar as CalendarIcon
} from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

// ─── Helpers ────────────────────────────────────────────────────────────────

function pct(v: number | null) {
    if (v === null) return "—"
    return `${(v * 100).toFixed(1)}%`
}

function qualityColor(v: number | null): string {
    if (v === null) return "text-muted-foreground"
    if (v >= 0.8) return "text-emerald-400"
    if (v >= 0.6) return "text-amber-400"
    return "text-red-400"
}

function qualityBarColor(v: number | null): string {
    if (v === null) return "bg-muted"
    if (v >= 0.8) return "bg-emerald-500"
    if (v >= 0.6) return "bg-amber-500"
    return "bg-red-500"
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function MetricBar({ value, label, icon }: { value: number | null; label: string; icon: React.ReactNode }) {
    const pctVal = value !== null ? Math.round(value * 100) : 0
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    {icon}
                    <span>{label}</span>
                </div>
                <span className={`text-2xl font-bold tabular-nums tracking-tight ${qualityColor(value)}`}>
                    {pct(value)}
                </span>
            </div>
            <div className="h-2 w-full rounded-full bg-border/40 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${qualityBarColor(value)}`}
                    style={{ width: `${pctVal}%` }}
                />
            </div>
        </div>
    )
}

function ModuleCard({ name, metric }: { name: string; metric: AggregatedMetric }) {
    return (
        <div className="group relative rounded-xl border border-border/50 bg-card/60 hover:bg-card/90 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 p-4 flex flex-col gap-3">
            {/* Subtle glow on hover */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary/60" />
                <span className="font-semibold text-sm tracking-tight">{name}</span>
            </div>

            <div className="flex flex-col gap-2.5">
                {/* Precision bar */}
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Precision</span>
                        <span className={`font-semibold ${qualityColor(metric.precision)}`}>{pct(metric.precision)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${qualityBarColor(metric.precision)}`}
                            style={{ width: metric.precision !== null ? `${Math.round(metric.precision * 100)}%` : "0%" }}
                        />
                    </div>
                </div>
                {/* Recall bar */}
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Recall</span>
                        <span className={`font-semibold ${qualityColor(metric.recall)}`}>{pct(metric.recall)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${qualityBarColor(metric.recall)}`}
                            style={{ width: metric.recall !== null ? `${Math.round(metric.recall * 100)}%` : "0%" }}
                        />
                    </div>
                </div>
            </div>

            {/* Run count hint */}
            <p className="text-xs text-muted-foreground/60 mt-auto">
                {metric.tp + metric.fp + metric.fn} issues · {metric.tp} TP
            </p>
        </div>
    )
}

// ─── Main panel ─────────────────────────────────────────────────────────────

interface DefaultPanelProps {
    allRuns: DashboardRun[]
}

export function DefaultPanel({ allRuns }: DefaultPanelProps) {
    const [dateFilter, setDateFilter] = useState("all")
    const [customDate, setCustomDate] = useState<Date | undefined>(undefined)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [selectorOpen, setSelectorOpen] = useState(false)

    // 1. Apply date filter first
    const dateFiltered = useMemo(() => filterRunsByDate(allRuns, dateFilter, customDate), [allRuns, dateFilter, customDate])

    // 2. Then apply run selection (if any)
    const activeRuns = useMemo(() => {
        if (selectedIds.size === 0) return dateFiltered
        return dateFiltered.filter((r) => selectedIds.has(r.id))
    }, [dateFiltered, selectedIds])

    const metrics = useMemo(() => computeDashboardMetrics(activeRuns), [activeRuns])

    const moduleNames = Object.keys(metrics.perModule).sort()

    const hasRunFilter = selectedIds.size > 0
    const hasDateFilter = dateFilter !== "all"

    return (
        <section id="default-panel" className="scroll-mt-20">
            {/* Panel identifier label */}
            <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-border/40" />
                <span className="text-xs font-mono font-medium text-muted-foreground/60 tracking-widest uppercase px-2">
                    default-panel
                </span>
                <div className="h-px flex-1 bg-border/40" />
            </div>

            {/* Main card */}
            <div className="relative rounded-2xl border border-border/50 overflow-hidden bg-card/50 backdrop-blur-sm shadow-2xl shadow-black/20">

                {/* Gradient accent top bar */}
                <div className="h-1 w-full bg-gradient-to-r from-primary/80 via-primary to-primary/40" />

                {/* Ambient glow */}
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-96 bg-primary/8 rounded-full blur-3xl pointer-events-none" />

                <div className="relative p-6 space-y-6">
                    {/* ── Header row ── */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Activity className="h-5 w-5 text-primary" />
                                <h2 className="text-xl font-bold tracking-tight">Performance Overview</h2>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Precision &amp; recall across{" "}
                                <span className="font-semibold text-foreground">{activeRuns.length}</span>{" "}
                                evaluation run{activeRuns.length !== 1 ? "s" : ""}
                                {activeRuns.length !== allRuns.length && (
                                    <span className="text-muted-foreground"> (of {allRuns.length} total)</span>
                                )}
                            </p>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {/* Date filter */}
                            <div className="flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                                <Select value={dateFilter} onValueChange={(v) => {
                                    setDateFilter(v);
                                    if (v !== "custom") setCustomDate(undefined);
                                }}>
                                    <SelectTrigger className="h-8 w-[140px] text-xs border-border/50 bg-background/60">
                                        <SelectValue placeholder="All time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All time</SelectItem>
                                        <SelectItem value="today">Today</SelectItem>
                                        <SelectItem value="last_7">Last 7 days</SelectItem>
                                        <SelectItem value="last_30">Last 30 days</SelectItem>
                                        <SelectItem value="custom">Specific date...</SelectItem>
                                    </SelectContent>
                                </Select>

                                {dateFilter === "custom" && (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={cn(
                                                    "h-8 justify-start text-left font-normal text-xs border-border/50 bg-background/60 min-w-[140px]",
                                                    !customDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                                {customDate ? format(customDate, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="end">
                                            <Calendar
                                                mode="single"
                                                selected={customDate}
                                                onSelect={setCustomDate}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>

                            {/* Run selector */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs border-border/50 bg-background/60 hover:bg-primary/10 hover:border-primary/30"
                                onClick={() => setSelectorOpen(true)}
                            >
                                <ListFilter className="h-3.5 w-3.5 mr-1.5" />
                                Select Runs
                                {hasRunFilter && (
                                    <Badge variant="secondary" className="ml-1.5 px-1.5 text-xs">
                                        {selectedIds.size}
                                    </Badge>
                                )}
                            </Button>

                            {/* Active filter indicator */}
                            {(hasRunFilter || hasDateFilter || !!customDate) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => { setDateFilter("all"); setCustomDate(undefined); setSelectedIds(new Set()) }}
                                >
                                    Reset
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* ── Global metrics ── */}
                    <div className="rounded-xl border border-border/40 bg-background/40 p-5 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <TrendingUp className="h-3.5 w-3.5" />
                            Global Metrics
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <MetricBar
                                value={metrics.global.precision}
                                label="Precision"
                                icon={<span className="text-xs">⬡</span>}
                            />
                            <MetricBar
                                value={metrics.global.recall}
                                label="Recall"
                                icon={<span className="text-xs">⬡</span>}
                            />
                        </div>
                    </div>

                    {/* ── Per-module grid ── */}
                    {moduleNames.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <Layers className="h-3.5 w-3.5" />
                                By Module
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {moduleNames.map((mod) => (
                                    <ModuleCard key={mod} name={mod} metric={metrics.perModule[mod]} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {activeRuns.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No runs match the current filters.</p>
                            <Button
                                variant="link"
                                size="sm"
                                className="mt-1 text-xs"
                                onClick={() => { setDateFilter("all"); setSelectedIds(new Set()) }}
                            >
                                Reset filters
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Run selector modal */}
            <RunSelectorDialog
                open={selectorOpen}
                onOpenChange={setSelectorOpen}
                runs={dateFiltered}
                selectedIds={selectedIds}
                onConfirm={setSelectedIds}
            />
        </section>
    )
}
