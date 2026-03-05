/**
 * Widget Client — Browser-side fetch wrappers
 *
 * Thin layer so UI components never call raw URLs directly.
 */

import { Widget, WidgetDefinition, WidgetSummary, WidgetType } from "@/types/widget"

/**
 * Fetch the lightweight list of all widgets (no snapshots).
 */
export async function fetchWidgetList(): Promise<WidgetSummary[]> {
    const res = await fetch("/api/widgets")
    if (!res.ok) throw new Error("Failed to fetch widget list")
    return res.json()
}

/**
 * Fetch a single widget with full data (including snapshots).
 */
export async function fetchWidget(id: string): Promise<Widget> {
    const res = await fetch(`/api/widgets/${encodeURIComponent(id)}`)
    if (!res.ok) throw new Error(`Failed to fetch widget ${id}`)
    return res.json()
}

/**
 * Create a new widget. Returns the created Widget.
 *
 * Accepts full definition from wizard modals, or falls back to defaults
 * when only type/name/description are provided.
 */
export async function createWidgetOnServer(data: {
    type: WidgetType
    name: string
    description?: string
    definition?: WidgetDefinition
}): Promise<Widget> {
    const res = await fetch("/api/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error("Failed to create widget")
    return res.json()
}

/**
 * Delete a widget by ID.
 */
export async function deleteWidgetOnServer(id: string): Promise<void> {
    const res = await fetch(`/api/widgets/${encodeURIComponent(id)}`, {
        method: "DELETE",
    })
    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to delete widget")
    }
}

/**
 * Generate a new Time Series snapshot for a widget.
 * Calls POST /api/widgets/:id/snapshot, which reads evaluation_history.json,
 * computes series data, and appends the result to the widget file.
 * Returns the updated widget (with the new snapshot appended).
 */
export async function generateSnapshot(
    id: string,
    options?: { overrideRunSelection?: { type: "latest"; count: number }; note?: string }
): Promise<Widget> {
    const res = await fetch(`/api/widgets/${encodeURIComponent(id)}/snapshot`, {
        method: "POST",
        headers: options ? { "Content-Type": "application/json" } : undefined,
        body: options ? JSON.stringify(options) : undefined,
    })
    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to generate snapshot")
    }
    return res.json()
}
