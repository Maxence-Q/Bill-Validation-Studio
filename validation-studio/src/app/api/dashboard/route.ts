import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

export interface DashboardRun {
    id: string
    eventName: string
    eventId: number | string
    timestamp: string
    status: string
    metrics?: {
        precision: number
        recall: number
        tp: number
        fp: number
        fn: number
    }
    moduleMetrics?: Record<
        string,
        { precision: number; recall: number; tp: number; fp: number; fn: number }
    >
}

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), "data", "evaluation_history.json")
        const raw = await fs.readFile(filePath, "utf-8")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allRuns: any[] = JSON.parse(raw)

        const slim: DashboardRun[] = allRuns.map((r) => ({
            id: r.id,
            eventName: r.eventName ?? "",
            eventId: r.eventId ?? r.targetEventId ?? "",
            timestamp: r.timestamp,
            status: r.status,
            metrics: r.metrics,
            moduleMetrics: r.moduleMetrics,
        }))

        return NextResponse.json(slim)
    } catch (err) {
        console.error("[dashboard API] Failed to read evaluation_history.json", err)
        return NextResponse.json({ error: "Failed to load data" }, { status: 500 })
    }
}
