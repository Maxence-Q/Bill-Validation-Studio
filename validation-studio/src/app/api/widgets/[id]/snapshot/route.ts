/**
 * POST /api/widgets/:id/snapshot
 *
 * Generates a new Time Series snapshot from the widget's current definition
 * and appends it to the widget's snapshots array.
 * Returns the updated widget (with the new snapshot).
 */

import { NextResponse } from "next/server"
import { loadWidget } from "@/lib/dashboard/widget-storage"
import { generateTimeSeriesSnapshot } from "@/lib/dashboard/timeSeriesSnapshot"
import { generateDistributionSnapshot } from "@/lib/dashboard/distributionSnapshot"

interface RouteContext {
    params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
    const { id } = await context.params
    try {
        const widget = await loadWidget(id)

        if (widget.type !== "time_series" && widget.type !== "distribution") {
            return NextResponse.json(
                { error: "Snapshot generation is only supported for time_series and distribution widgets." },
                { status: 400 }
            )
        }

        const body = await request.json().catch(() => ({}))
        const options = {
            ...(body.overrideRunSelection ? { overrideRunSelection: body.overrideRunSelection } : {}),
            ...(body.note ? { note: body.note } : {}),
        }

        let updated;
        if (widget.type === "time_series") {
            updated = await generateTimeSeriesSnapshot(id, widget.definition, options)
        } else if (widget.type === "distribution") {
            updated = await generateDistributionSnapshot(id, widget.definition, options)
        }
        return NextResponse.json(updated, { status: 201 })
    } catch (err) {
        console.error(`[api/widgets/${id}/snapshot] POST error:`, err)
        const message = err instanceof Error ? err.message : "Failed to generate snapshot"
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
