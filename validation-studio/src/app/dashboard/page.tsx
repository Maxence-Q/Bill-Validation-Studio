/**
 * Dashboard Page
 *
 * Top-level route for the Dashboard section. Fetches evaluation run data,
 * renders the page hero (with a "Create new Widget" entry point),
 * a widget navigator bar, and the active widget content.
 *
 * Default view: Default Panel (Performance Overview).
 * Users can browse all widgets via a navigation modal.
 * Distribution and Time Series widgets have dedicated creation wizards.
 */

"use client"

import { useEffect, useState, useCallback } from "react"
import { DashboardRun } from "@/app/api/dashboard/route"
import { DefaultPanel } from "@/components/dashboard/default-panel"
import { CreateWidgetDialog, WidgetTypeId } from "@/components/dashboard/create-widget-dialog"
import { WidgetNavigator } from "@/components/dashboard/widget-navigator"
import { WidgetNavigationModal } from "@/components/dashboard/widget-navigation-modal"
import { createWidgetOnServer, fetchWidget, generateSnapshot } from "@/lib/dashboard/widget-client"
import { Widget, WidgetType, WidgetDefinition } from "@/types/widget"
import { Activity, LayoutDashboard, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

// Widget-specific imports
import { CreateDistributionWidgetModal } from "@/components/dashboard/widgets/distribution/CreateDistributionWidgetModal"
import { DistributionWidget } from "@/components/dashboard/widgets/distribution/DistributionWidget"
import { CreateTimeSeriesWidgetModal } from "@/components/dashboard/widgets/timeSeries/CreateTimeSeriesWidgetModal"
import { TimeSeriesWidget } from "@/components/dashboard/widgets/timeSeries/TimeSeriesWidget"

// ─── Map CreateWidgetDialog IDs → storage WidgetType ──────────────────────────

const DIALOG_TYPE_TO_WIDGET_TYPE: Record<WidgetTypeId, WidgetType> = {
    "histogram": "histogram",
    "time-series": "time_series",
    "kpi": "main_kpi",
    "breakdown": "breakdown_table",
    "pie": "distribution",
    "heatmap": "score_heatmap",
}

const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
    default_panel: "Default Panel",
    histogram: "Histogram",
    time_series: "Time Series",
    main_kpi: "Main KPI",
    breakdown_table: "Breakdown Table",
    distribution: "Distribution",
    score_heatmap: "Score Heatmap",
}

export default function DashboardPage() {
    const [runs, setRuns] = useState<DashboardRun[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [widgetDialogOpen, setWidgetDialogOpen] = useState(false)
    const [navModalOpen, setNavModalOpen] = useState(false)

    // Wizard modal state
    const [distributionWizardOpen, setDistributionWizardOpen] = useState(false)
    const [timeSeriesWizardOpen, setTimeSeriesWizardOpen] = useState(false)

    // Active widget state
    const [activeWidgetId, setActiveWidgetId] = useState<string>("default-panel")
    const [activeWidget, setActiveWidget] = useState<Widget | null>(null)
    const [widgetLoading, setWidgetLoading] = useState(false)

    // Fetch evaluation runs
    useEffect(() => {
        fetch("/api/dashboard")
            .then((r) => {
                if (!r.ok) throw new Error("Failed to load dashboard data")
                return r.json()
            })
            .then((data: DashboardRun[]) => {
                setRuns(data)
                setLoading(false)
            })
            .catch((err) => {
                setError(err.message)
                setLoading(false)
            })
    }, [])

    // Load the active widget when it changes (skip for default panel)
    const loadActiveWidget = useCallback(async (id: string) => {
        if (id === "default-panel") {
            setActiveWidget(null)
            return
        }
        setWidgetLoading(true)
        try {
            const widget = await fetchWidget(id)
            setActiveWidget(widget)
        } catch (err) {
            console.error("Failed to load widget:", err)
            // Fall back to default panel
            setActiveWidgetId("default-panel")
            setActiveWidget(null)
        } finally {
            setWidgetLoading(false)
        }
    }, [])

    useEffect(() => {
        loadActiveWidget(activeWidgetId)
    }, [activeWidgetId, loadActiveWidget])

    // Handle quick-create for widget types without wizards
    const handleAddWidget = async (widgetTypeId: WidgetTypeId) => {
        const storageType = DIALOG_TYPE_TO_WIDGET_TYPE[widgetTypeId]
        const label = WIDGET_TYPE_LABELS[storageType] ?? "Widget"

        try {
            const created = await createWidgetOnServer({
                type: storageType,
                name: `New ${label}`,
                description: "",
            })
            // Switch to the newly created widget
            setActiveWidgetId(created.id)
        } catch (err) {
            console.error("Failed to create widget:", err)
        }
    }

    // Handle wizard launch from the type selector dialog
    const handleLaunchWizard = (widgetTypeId: WidgetTypeId) => {
        if (widgetTypeId === "pie") {
            setDistributionWizardOpen(true)
        } else if (widgetTypeId === "time-series") {
            setTimeSeriesWizardOpen(true)
        }
    }

    // Handle wizard completion — create widget with full definition
    const handleWizardCreate = async (
        type: WidgetType,
        data: { name: string; description: string; definition: WidgetDefinition }
    ) => {
        try {
            const created = await createWidgetOnServer({
                type,
                name: data.name,
                description: data.description,
                definition: data.definition,
            })

            // For time_series and distribution, immediately generate the initial snapshot so
            // the widget shows data as soon as it becomes active.
            if (type === "time_series" || type === "distribution") {
                try {
                    const withSnapshot = await generateSnapshot(created.id)
                    // Set the widget directly (already has snapshot) — skip the
                    // separate fetchWidget call that loadActiveWidget would make.
                    setActiveWidgetId(withSnapshot.id)
                    setActiveWidget(withSnapshot)
                } catch (snapErr) {
                    // Snapshot generation failed (e.g. no matching runs) —
                    // still navigate to the widget; it will show the empty state.
                    console.warn("[dashboard] Initial snapshot generation failed:", snapErr)
                    setActiveWidgetId(created.id)
                }
            } else {
                setActiveWidgetId(created.id)
            }
        } catch (err) {
            console.error("Failed to create widget:", err)
        }
    }

    const handleSelectWidget = (id: string) => {
        setActiveWidgetId(id)
    }

    // Determine current widget metadata for the navigator bar
    const currentWidgetName = activeWidgetId === "default-panel"
        ? "Performance Overview"
        : activeWidget?.name ?? "Loading…"
    const currentWidgetType: WidgetType = activeWidgetId === "default-panel"
        ? "default_panel"
        : activeWidget?.type ?? "default_panel"

    // ─── Render the active widget by type ────────────────────────────────────
    const handleWidgetUpdate = (updated: Widget) => {
        setActiveWidget(updated)
    }

    const renderActiveWidget = () => {
        if (!activeWidget) return null

        switch (activeWidget.type) {
            case "distribution":
                return <DistributionWidget widget={activeWidget} onWidgetUpdate={handleWidgetUpdate} />
            case "time_series":
                return <TimeSeriesWidget widget={activeWidget} onWidgetUpdate={handleWidgetUpdate} />
            default:
                // Generic placeholder for other types
                return (
                    <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm p-8">
                        <div className="flex flex-col items-center gap-4 text-center py-12">
                            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                                <Activity className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold">{activeWidget.name}</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {WIDGET_TYPE_LABELS[activeWidget.type] ?? "Widget"} — {activeWidget.snapshots.length} snapshot{activeWidget.snapshots.length !== 1 ? "s" : ""}
                                </p>
                            </div>
                            <p className="text-xs text-muted-foreground/60 max-w-md">
                                Widget rendering is coming soon. This widget has been created and saved to <code>data/widgets/</code>.
                            </p>
                        </div>
                    </div>
                )
        }
    }

    return (
        <div className="min-h-[calc(100vh-3.5rem)] bg-background">
            {/* Page hero */}
            <div className="relative border-b border-border/40 bg-gradient-to-b from-primary/5 via-background to-background">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 right-0 h-80 w-80 bg-primary/6 rounded-full blur-3xl" />
                    <div className="absolute -top-20 left-1/4 h-60 w-60 bg-primary/4 rounded-full blur-2xl" />
                </div>
                <div className="relative container max-w-screen-xl mx-auto px-6 py-8">
                    <div className="flex items-center justify-between gap-4">
                        {/* Title block */}
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                                <LayoutDashboard className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                                <p className="text-sm text-muted-foreground">
                                    High-level insights across all evaluation runs
                                </p>
                            </div>
                        </div>

                        {/* Create new Widget CTA */}
                        <Button
                            id="create-widget-btn"
                            onClick={() => setWidgetDialogOpen(true)}
                            className="relative group gap-2 overflow-hidden bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all duration-200 hover:shadow-primary/30 hover:shadow-xl"
                        >
                            {/* Shimmer */}
                            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            <Plus className="h-4 w-4" />
                            Create new Widget
                        </Button>
                    </div>
                </div>
            </div>

            {/* Widget Navigator */}
            <div className="container max-w-screen-xl mx-auto px-6 pt-4">
                <WidgetNavigator
                    widgetName={currentWidgetName}
                    widgetType={currentWidgetType}
                    onOpenModal={() => setNavModalOpen(true)}
                />
            </div>

            {/* Content */}
            <div className="container max-w-screen-xl mx-auto px-6 py-4">
                {loading && (
                    <div className="flex items-center justify-center py-24 text-muted-foreground">
                        <Activity className="h-6 w-6 animate-pulse mr-2" />
                        <span className="text-sm">Loading evaluation data…</span>
                    </div>
                )}

                {error && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
                        <p className="text-sm text-destructive font-medium">Error: {error}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Make sure <code>data/evaluation_history.json</code> exists and is valid.
                        </p>
                    </div>
                )}

                {!loading && !error && activeWidgetId === "default-panel" && (
                    <DefaultPanel allRuns={runs} />
                )}

                {!loading && !error && activeWidgetId !== "default-panel" && (
                    <>
                        {widgetLoading ? (
                            <div className="flex items-center justify-center py-24 text-muted-foreground">
                                <Activity className="h-5 w-5 animate-pulse mr-2" />
                                <span className="text-sm">Loading widget…</span>
                            </div>
                        ) : activeWidget ? (
                            renderActiveWidget()
                        ) : null}
                    </>
                )}
            </div>

            {/* Widget type selection modal */}
            <CreateWidgetDialog
                open={widgetDialogOpen}
                onOpenChange={setWidgetDialogOpen}
                onAdd={handleAddWidget}
                onLaunchWizard={handleLaunchWizard}
            />

            {/* Widget navigation modal */}
            <WidgetNavigationModal
                open={navModalOpen}
                onOpenChange={setNavModalOpen}
                activeWidgetId={activeWidgetId}
                onSelectWidget={handleSelectWidget}
            />

            {/* Distribution wizard modal */}
            <CreateDistributionWidgetModal
                open={distributionWizardOpen}
                onOpenChange={setDistributionWizardOpen}
                onCreate={(data) => {
                    setDistributionWizardOpen(false)
                    handleWizardCreate("distribution", data)
                }}
            />

            {/* Time Series wizard modal */}
            <CreateTimeSeriesWidgetModal
                open={timeSeriesWizardOpen}
                onOpenChange={setTimeSeriesWizardOpen}
                onCreate={(data) => {
                    setTimeSeriesWizardOpen(false)
                    handleWizardCreate("time_series", data)
                }}
            />
        </div>
    )
}
