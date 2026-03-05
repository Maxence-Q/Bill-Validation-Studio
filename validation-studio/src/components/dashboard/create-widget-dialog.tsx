/**
 * CreateWidgetDialog Component
 *
 * Entry point for the widget-builder feature. Presents a selection grid of
 * available widget types, each shown as a premium clickable card with a
 * mini chart preview, title, and description. On confirmation, passes the
 * chosen widget type ID up to the parent via `onAdd`.
 */

"use client"

import { useState } from "react"
import ReactMarkdown from "react-markdown"
import { getWidgetDocs } from "@/app/actions/docs"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    BarChart3,
    BookOpen,
    LineChart,
    PieChart,
    LayoutList,
    Gauge,
    Grid3x3,
} from "lucide-react"

// ─── Widget type catalogue ────────────────────────────────────────────────────

export type WidgetTypeId =
    | "histogram"
    | "time-series"
    | "kpi"
    | "breakdown"
    | "pie"
    | "heatmap"

interface WidgetTypeDefinition {
    id: WidgetTypeId
    title: string
    description: string
    icon: React.ComponentType<{ className?: string }>
    preview: React.ReactNode
    badge?: string
    accentClass: string
}

/** Tiny inline SVG silhouettes — no external deps, zero overhead. */
function BarPreview() {
    return (
        <svg viewBox="0 0 80 40" className="w-full h-full" aria-hidden>
            {[
                { x: 4, h: 20, y: 20 },
                { x: 16, h: 32, y: 8 },
                { x: 28, h: 14, y: 26 },
                { x: 40, h: 26, y: 14 },
                { x: 52, h: 36, y: 4 },
                { x: 64, h: 18, y: 22 },
            ].map((b, i) => (
                <rect
                    key={i}
                    x={b.x} y={b.y} width={10} height={b.h}
                    rx={2}
                    className="fill-primary/40"
                />
            ))}
        </svg>
    )
}

function LinePreview() {
    const pts = "4,34 16,22 28,28 40,10 52,18 64,6 76,14"
    return (
        <svg viewBox="0 0 80 40" className="w-full h-full text-primary" aria-hidden>
            <defs>
                <linearGradient id="lg-line" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={`4,40 ${pts} 76,40`} fill="url(#lg-line)" />
            <polyline points={pts} fill="none" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function PiePreview() {
    // Three hand-drawn arcs as colored wedges
    return (
        <svg viewBox="0 0 80 40" className="w-full h-full" aria-hidden>
            <g transform="translate(40,20)">
                {/* Large slice ~55% */}
                <path d="M0,0 L0,-17 A17,17 0 1,1 -16.2,4.9 Z" className="fill-primary/50" />
                {/* Medium slice ~30% */}
                <path d="M0,0 L-16.2,4.9 A17,17 0 0,1 7.4,-15.3 Z" className="fill-primary/25" />
                {/* Small slice ~15% */}
                <path d="M0,0 L7.4,-15.3 A17,17 0 0,1 0,-17 Z" className="fill-primary/15" />
            </g>
        </svg>
    )
}

function GaugePreview() {
    return (
        <svg viewBox="0 0 80 44" className="w-full h-full" aria-hidden>
            <path d="M8,40 A32,32 0 0,1 72,40" fill="none" className="stroke-border/60" strokeWidth="6" strokeLinecap="round" />
            <path d="M8,40 A32,32 0 0,1 58,14" fill="none" className="stroke-primary/60" strokeWidth="6" strokeLinecap="round" />
            <line x1="40" y1="40" x2="54" y2="16" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="40" cy="40" r="3" className="fill-primary" />
        </svg>
    )
}

function ListPreview() {
    return (
        <svg viewBox="0 0 80 40" className="w-full h-full" aria-hidden>
            {[8, 18, 28].map((y, i) => (
                <g key={i}>
                    <rect x={4} y={y} width={6} height={6} rx={1} className="fill-primary/40" />
                    <rect x={14} y={y + 1} width={30 + i * 8} height={4} rx={2} className="fill-border/60" />
                    <rect x={50 + i * 4} y={y + 1} width={24 - i * 4} height={4} rx={2} className="fill-primary/20" />
                </g>
            ))}
        </svg>
    )
}

function HeatmapPreview() {
    const cells = [
        [0.9, 0.5, 0.2, 0.8],
        [0.4, 0.7, 0.95, 0.3],
        [0.6, 0.1, 0.55, 0.85],
    ]
    return (
        <svg viewBox="0 0 80 40" className="w-full h-full" aria-hidden>
            {cells.map((row, ri) =>
                row.map((v, ci) => (
                    <rect
                        key={`${ri}-${ci}`}
                        x={ci * 19 + 3} y={ri * 12 + 2} width={17} height={10} rx={2}
                        className="fill-primary"
                        opacity={v}
                    />
                ))
            )}
        </svg>
    )
}

const WIDGET_TYPES: WidgetTypeDefinition[] = [
    {
        id: "histogram",
        title: "Histogram",
        description: "Compare volumes and errors by module.",
        icon: BarChart3,
        preview: <BarPreview />,
        accentClass: "text-sky-400",
    },
    {
        id: "time-series",
        title: "Time Series",
        description: "Track metrics over time across runs.",
        icon: LineChart,
        preview: <LinePreview />,
        badge: "Popular",
        accentClass: "text-violet-400",
    },
    {
        id: "kpi",
        title: "Main KPI",
        description: "Headline precision & recall at a glance.",
        icon: Gauge,
        preview: <GaugePreview />,
        accentClass: "text-emerald-400",
    },
    {
        id: "breakdown",
        title: "Breakdown Table",
        description: "Detailed per-module TP / FP / FN list.",
        icon: LayoutList,
        preview: <ListPreview />,
        accentClass: "text-amber-400",
    },
    {
        id: "pie",
        title: "Distribution",
        description: "Visual share of each module's issues.",
        icon: PieChart,
        preview: <PiePreview />,
        accentClass: "text-rose-400",
    },
    {
        id: "heatmap",
        title: "Score Heatmap",
        description: "Color-coded grid of module quality.",
        icon: Grid3x3,
        preview: <HeatmapPreview />,
        accentClass: "text-cyan-400",
    },
]

// ─── WidgetTypeCard ───────────────────────────────────────────────────────────

interface WidgetTypeCardProps {
    definition: WidgetTypeDefinition
    selected: boolean
    onSelect: () => void
}

function WidgetTypeCard({ definition, selected, onSelect }: WidgetTypeCardProps) {
    const Icon = definition.icon
    return (
        <button
            type="button"
            onClick={onSelect}
            className={[
                "group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-200 outline-none",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                selected
                    ? "border-primary/70 bg-primary/8 shadow-lg shadow-primary/10 ring-1 ring-primary/40"
                    : "border-border/50 bg-card/60 hover:border-primary/30 hover:bg-card/90 hover:shadow-lg hover:shadow-primary/5",
            ].join(" ")}
        >
            {/* Ambient glow on hover / selected */}
            <div
                className={[
                    "absolute inset-0 rounded-xl bg-gradient-to-br from-primary/8 to-transparent pointer-events-none transition-opacity duration-200",
                    selected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                ].join(" ")}
            />

            {/* Badge */}
            {definition.badge && (
                <Badge
                    variant="outline"
                    className="absolute top-2.5 right-2.5 z-20 bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0 h-5 font-semibold backdrop-blur-sm shadow-sm"
                >
                    {definition.badge}
                </Badge>
            )}

            {/* Mini chart preview area */}
            <div className="relative h-10 w-full overflow-hidden rounded-lg bg-background/40 border border-border/30 px-1 py-0.5">
                {definition.preview}
            </div>

            {/* Icon + title */}
            <div className="flex items-center gap-2 z-10">
                <Icon className={`h-5 w-5 flex-shrink-0 ${definition.accentClass} transition-transform duration-200 group-hover:scale-110`} />
                <span className="font-semibold text-sm tracking-tight leading-tight">{definition.title}</span>
            </div>

            {/* Description */}
            <p className="text-xs text-muted-foreground/80 leading-snug z-10">{definition.description}</p>

            {/* Selected indicator */}
            {selected && (
                <div className="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-primary shadow-sm shadow-primary/50" />
            )}
        </button>
    )
}

// ─── CreateWidgetDialog ────────────────────────────────────────────────────────

interface CreateWidgetDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Called with the chosen widget type id when the user confirms (quick-create for unsupported types). */
    onAdd: (widgetType: WidgetTypeId) => void
    /** Called when the user selects a type that has a dedicated wizard (distribution, time-series). */
    onLaunchWizard?: (widgetType: WidgetTypeId) => void
}

/** Widget types that have a dedicated creation wizard */
const WIZARD_TYPES: Set<WidgetTypeId> = new Set(["pie", "time-series"])

export function CreateWidgetDialog({ open, onOpenChange, onAdd, onLaunchWizard }: CreateWidgetDialogProps) {
    const [selected, setSelected] = useState<WidgetTypeId | null>(null)
    const [docsOpen, setDocsOpen] = useState(false)
    const [docsContent, setDocsContent] = useState("")
    const [docsLoading, setDocsLoading] = useState(false)

    const handleOpenChange = (v: boolean) => {
        if (!v) setSelected(null)
        onOpenChange(v)
    }

    const handleAdd = () => {
        if (!selected) return

        // If this type has a wizard, delegate to the wizard launcher
        if (WIZARD_TYPES.has(selected) && onLaunchWizard) {
            onLaunchWizard(selected)
            setSelected(null)
            onOpenChange(false)
            return
        }

        // Otherwise quick-create
        onAdd(selected)
        setSelected(null)
        onOpenChange(false)
    }

    const handleOpenDocs = async () => {
        setDocsOpen(true)
        if (!docsContent) {
            setDocsLoading(true)
            try {
                const text = await getWidgetDocs()
                setDocsContent(text)
            } catch (err) {
                setDocsContent("Failed to load documentation.")
            } finally {
                setDocsLoading(false)
            }
        }
    }

    return (
        <>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent className="max-w-2xl p-0 overflow-hidden border border-border/60 bg-card/95 backdrop-blur-xl">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4 border-b border-border/40">
                        <DialogHeader>
                            <div className="flex items-center justify-between pr-8">
                                <DialogTitle className="text-xl font-bold tracking-tight">
                                    Add a Widget
                                </DialogTitle>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleOpenDocs}
                                    className="h-8 text-xs border-border/50 bg-background/60 hover:bg-primary/10 hover:border-primary/30"
                                >
                                    <BookOpen className="h-3.5 w-3.5 mr-1.5 text-primary" />
                                    Documentation
                                </Button>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 text-left">
                                Choose a widget type to add to your dashboard.
                            </p>
                        </DialogHeader>
                    </div>

                    {/* Widget grid */}
                    <div className="px-6 py-5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {WIDGET_TYPES.map((def) => (
                                <WidgetTypeCard
                                    key={def.id}
                                    definition={def}
                                    selected={selected === def.id}
                                    onSelect={() => setSelected(def.id)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20">
                        <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAdd}
                            disabled={!selected}
                            className="min-w-[130px]"
                        >
                            {selected && WIZARD_TYPES.has(selected) ? "Next →" : "Add Widget"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={docsOpen} onOpenChange={setDocsOpen}>
                <DialogContent className="max-w-3xl h-[85vh] p-0 flex flex-col overflow-hidden border border-border/60 bg-card/95 backdrop-blur-xl">
                    <DialogHeader className="px-6 py-4 border-b border-border/40 bg-muted/20 shrink-0">
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            Widgets Documentation
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                            {docsLoading ? (
                                <p className="text-muted-foreground animate-pulse">Loading documentation...</p>
                            ) : (
                                <ReactMarkdown>{docsContent}</ReactMarkdown>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
