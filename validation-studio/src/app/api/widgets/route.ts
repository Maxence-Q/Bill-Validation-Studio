/**
 * GET  /api/widgets       → List all widgets (summaries, no snapshots)
 * POST /api/widgets       → Create a new widget
 */

import { NextResponse } from "next/server"
import { listWidgets, createWidget } from "@/lib/dashboard/widget-storage"
import { Widget } from "@/types/widget"
import { v4 as uuidv4 } from "uuid"

export async function GET() {
    try {
        const summaries = await listWidgets()
        return NextResponse.json(summaries)
    } catch (err) {
        console.error("[api/widgets] GET error:", err)
        return NextResponse.json({ error: "Failed to list widgets" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()

        const now = new Date().toISOString()
        const widget: Widget = {
            id: uuidv4(),
            type: body.type ?? "time_series",
            name: body.name ?? "Untitled Widget",
            createdAt: now,
            updatedAt: now,
            isRemovable: true,
            description: body.description ?? "",
            definition: body.definition ?? {
                query: {
                    runSelection: { type: "latest", count: 0 },
                    scope: { modules: [], perturbationTypes: [] },
                    metrics: ["precision", "recall"],
                    groupBy: null,
                    aggregation: null,
                },
            },
            snapshots: body.snapshots ?? [],
        }

        const created = await createWidget(widget)
        return NextResponse.json(created, { status: 201 })
    } catch (err) {
        console.error("[api/widgets] POST error:", err)
        const message = err instanceof Error ? err.message : "Failed to create widget"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
