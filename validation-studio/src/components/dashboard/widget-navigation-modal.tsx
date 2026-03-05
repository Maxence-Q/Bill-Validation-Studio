/**
 * WidgetNavigationModal Component
 *
 * Full-screen grid modal showing all widgets as preview cards.
 * Rendered from lightweight WidgetSummary data — no snapshot loading.
 * The currently active widget is highlighted with a white border.
 * The default panel shows a lock icon and no delete button.
 */

"use client"

import { useEffect, useState, useCallback } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    BarChart3,
    LineChart,
    PieChart,
    Gauge,
    LayoutList,
    Grid3x3,
    LayoutDashboard,
    Lock,
    Trash2,
    Camera,
    Clock,
} from "lucide-react"
import { WidgetSummary, WidgetType } from "@/types/widget"
import { fetchWidgetList, deleteWidgetOnServer } from "@/lib/dashboard/widget-client"

// ─── Type → Icon / Accent mapping ────────────────────────────────────────────

const WIDGET_TYPE_META: Record<WidgetType, {
    icon: React.ComponentType<{ className?: string }>
    accentClass: string
    label: string
}> = {
    default_panel: { icon: LayoutDashboard, accentClass: "text-primary", label: "Default Panel" },
    histogram: { icon: BarChart3, accentClass: "text-sky-400", label: "Histogram" },
    time_series: { icon: LineChart, accentClass: "text-violet-400", label: "Time Series" },
    main_kpi: { icon: Gauge, accentClass: "text-emerald-400", label: "Main KPI" },
    breakdown_table: { icon: LayoutList, accentClass: "text-amber-400", label: "Breakdown Table" },
    distribution: { icon: PieChart, accentClass: "text-rose-400", label: "Distribution" },
    score_heatmap: { icon: Grid3x3, accentClass: "text-cyan-400", label: "Score Heatmap" },
}

// ─── Preview Card ────────────────────────────────────────────────────────────

interface PreviewCardProps {
    widget: WidgetSummary
    isActive: boolean
    onSelect: () => void
    onDelete?: () => void
}

function PreviewCard({ widget, isActive, onSelect, onDelete }: PreviewCardProps) {
    const meta = WIDGET_TYPE_META[widget.type] ?? WIDGET_TYPE_META.default_panel
    const Icon = meta.icon

    return (
        <button
            type="button"
            onClick={onSelect}
            className={[
                "group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-200 outline-none",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                    ? "border-white/70 bg-white/5 shadow-lg shadow-white/5 ring-1 ring-white/40"
                    : "border-border/40 bg-card/40 hover:border-primary/30 hover:bg-card/70 hover:shadow-lg hover:shadow-primary/5",
            ].join(" ")}
        >
            {/* Ambient glow */}
            <div
                className={[
                    "absolute inset-0 rounded-xl bg-gradient-to-br from-primary/6 to-transparent pointer-events-none transition-opacity duration-200",
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                ].join(" ")}
            />

            {/* Lock badge for non-removable */}
            {!widget.isRemovable && (
                <div className="absolute top-2.5 right-2.5 z-20">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
                </div>
            )}

            {/* Icon + Title */}
            <div className="flex items-center gap-2.5 z-10">
                <div className={`p-1.5 rounded-lg bg-background/60 border border-border/30`}>
                    <Icon className={`h-4 w-4 ${meta.accentClass}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm tracking-tight truncate">{widget.name}</p>
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium">{meta.label}</p>
                </div>
            </div>

            {/* Description */}
            {widget.description && (
                <p className="text-xs text-muted-foreground/70 leading-snug z-10 line-clamp-2">{widget.description}</p>
            )}

            {/* Bottom row: metadata */}
            <div className="flex items-center gap-3 z-10 mt-auto">
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50">
                    <Camera className="h-3 w-3" />
                    {widget.snapshotCount}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50">
                    <Clock className="h-3 w-3" />
                    {new Date(widget.createdAt).toLocaleDateString()}
                </span>
            </div>

            {/* Active indicator dot */}
            {isActive && (
                <div className="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-white shadow-sm shadow-white/50 z-10" />
            )}

            {/* Delete button (only for removable, non-active) */}
            {widget.isRemovable && onDelete && (
                <div
                    className="absolute top-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    onClick={(e) => {
                        e.stopPropagation()
                        onDelete()
                    }}
                >
                    <div className="p-1 rounded-md bg-destructive/20 hover:bg-destructive/40 transition-colors cursor-pointer">
                        <Trash2 className="h-3 w-3 text-destructive" />
                    </div>
                </div>
            )}
        </button>
    )
}

// ─── WidgetNavigationModal ───────────────────────────────────────────────────

interface WidgetNavigationModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    activeWidgetId: string
    onSelectWidget: (id: string) => void
}

export function WidgetNavigationModal({ open, onOpenChange, activeWidgetId, onSelectWidget }: WidgetNavigationModalProps) {
    const [widgets, setWidgets] = useState<WidgetSummary[]>([])
    const [loading, setLoading] = useState(false)

    const loadWidgets = useCallback(async () => {
        setLoading(true)
        try {
            const list = await fetchWidgetList()
            setWidgets(list)
        } catch (err) {
            console.error("Failed to load widgets:", err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (open) loadWidgets()
    }, [open, loadWidgets])

    const handleSelect = (id: string) => {
        onSelectWidget(id)
        onOpenChange(false)
    }

    const handleDelete = async (id: string) => {
        try {
            await deleteWidgetOnServer(id)
            setWidgets((prev) => prev.filter((w) => w.id !== id))
            // If we deleted the active widget, fall back to default
            if (id === activeWidgetId) {
                onSelectWidget("default-panel")
            }
        } catch (err) {
            console.error("Failed to delete widget:", err)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-[95vw] w-full h-[90vh] sm:h-[90vh] max-h-[95vh] flex flex-col p-0 overflow-hidden border border-border/60 bg-card/95 backdrop-blur-xl">
                {/* Header */}
                <div className="shrink-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4 border-b border-border/40">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                            <LayoutDashboard className="h-5 w-5 text-primary" />
                            Widgets
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground mt-1 text-left">
                            Select a widget to display on your dashboard.
                        </p>
                    </DialogHeader>
                </div>

                {/* Widget grid */}
                <ScrollArea className="flex-1">
                    <div className="px-6 py-5">
                        {loading ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground">
                                <LayoutDashboard className="h-5 w-5 animate-pulse mr-2" />
                                <span className="text-sm">Loading widgets…</span>
                            </div>
                        ) : widgets.length === 0 ? (
                            <div className="text-center text-muted-foreground py-12 text-sm">
                                No widgets found.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {widgets.map((w) => (
                                    <PreviewCard
                                        key={w.id}
                                        widget={w}
                                        isActive={w.id === activeWidgetId}
                                        onSelect={() => handleSelect(w.id)}
                                        onDelete={w.isRemovable ? () => handleDelete(w.id) : undefined}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="shrink-0 px-6 py-3 border-t border-border/40 bg-muted/10 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground/60">
                        {widgets.length} widget{widgets.length !== 1 ? "s" : ""}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export { WIDGET_TYPE_META }
