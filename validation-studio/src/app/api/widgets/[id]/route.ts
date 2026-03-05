/**
 * GET    /api/widgets/:id  → Load full widget (with snapshots)
 * PUT    /api/widgets/:id  → Update widget definition
 * DELETE /api/widgets/:id  → Delete widget (refuses default-panel)
 */

import { NextResponse } from "next/server"
import { loadWidget, saveWidgetDefinition, deleteWidget } from "@/lib/dashboard/widget-storage"

interface RouteContext {
    params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
    const { id } = await context.params
    try {
        const widget = await loadWidget(id)
        return NextResponse.json(widget)
    } catch (err) {
        console.error(`[api/widgets/${id}] GET error:`, err)
        return NextResponse.json({ error: "Widget not found" }, { status: 404 })
    }
}

export async function PUT(request: Request, context: RouteContext) {
    const { id } = await context.params
    try {
        const body = await request.json()
        const updated = await saveWidgetDefinition(id, body.definition)
        return NextResponse.json(updated)
    } catch (err) {
        console.error(`[api/widgets/${id}] PUT error:`, err)
        return NextResponse.json({ error: "Failed to update widget" }, { status: 500 })
    }
}

export async function DELETE(_request: Request, context: RouteContext) {
    const { id } = await context.params
    try {
        await deleteWidget(id)
        return NextResponse.json({ ok: true })
    } catch (err) {
        console.error(`[api/widgets/${id}] DELETE error:`, err)
        const message = err instanceof Error ? err.message : "Failed to delete widget"
        const status = message.includes("cannot be deleted") ? 403 : 500
        return NextResponse.json({ error: message }, { status })
    }
}
