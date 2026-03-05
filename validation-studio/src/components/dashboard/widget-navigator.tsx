/**
 * WidgetNavigator Component
 *
 * Subtle navigation bar rendered above the active widget.
 * Shows the current widget name/type with left/right chevrons.
 * Clicking either chevron opens the navigation modal.
 */

"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { WidgetType } from "@/types/widget"
import { WIDGET_TYPE_META } from "@/components/dashboard/widget-navigation-modal"

interface WidgetNavigatorProps {
    widgetName: string
    widgetType: WidgetType
    onOpenModal: () => void
}

export function WidgetNavigator({ widgetName, widgetType, onOpenModal }: WidgetNavigatorProps) {
    const meta = WIDGET_TYPE_META[widgetType] ?? WIDGET_TYPE_META.default_panel
    const Icon = meta.icon

    return (
        <div className="flex items-center justify-center gap-2 py-3">
            {/* Left chevron */}
            <button
                type="button"
                onClick={onOpenModal}
                className="p-1.5 rounded-lg border border-border/30 bg-card/40 hover:bg-card/80 hover:border-primary/30 transition-all duration-150 text-muted-foreground hover:text-foreground"
                aria-label="Browse widgets"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Center: type label + name */}
            <button
                type="button"
                onClick={onOpenModal}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg border border-border/30 bg-card/40 hover:bg-card/80 hover:border-primary/30 transition-all duration-150 cursor-pointer group"
            >
                <Icon className={`h-3.5 w-3.5 ${meta.accentClass} transition-transform duration-200 group-hover:scale-110`} />
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground/70 font-medium">
                    {meta.label}
                </span>
                <span className="text-xs text-muted-foreground/40 mx-0.5">·</span>
                <span className="text-xs font-medium text-foreground/80 truncate max-w-[200px]">
                    {widgetName}
                </span>
            </button>

            {/* Right chevron */}
            <button
                type="button"
                onClick={onOpenModal}
                className="p-1.5 rounded-lg border border-border/30 bg-card/40 hover:bg-card/80 hover:border-primary/30 transition-all duration-150 text-muted-foreground hover:text-foreground"
                aria-label="Browse widgets"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    )
}
