import { NextRequest, NextResponse } from "next/server";
import { ValidationRecord } from "@/lib/configuration/storage-core";
import { ResultStorage } from "@/lib/validation/orchestrator-modules/result-storage";
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
    try {
        const history = ResultStorage.getHistory('evaluation');
        // Sort by timestamp descending
        history.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return NextResponse.json(history);
    } catch (error) {
        console.error("Failed to fetch evaluation history:", error);
        return NextResponse.json({ error: "Failed to fetch evaluation history" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { eventId, eventName, status, issues, prompts, perturbations } = body;

        // Note: looser validation for initial creation if needed, but keeping consistent
        if (!eventId || !status) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const record: ValidationRecord = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            eventId,
            eventName: eventName || "Unknown Event",
            status,
            issuesCount: issues ? issues.length : 0,
            issues: issues || [],
            prompts: prompts || {},
            // ValidationRecord usually doesn't have 'perturbations' at root, but 'perturbationTracking'
            // However, we are flexible here as this is likely for importing or manual creation.
            // If the type definition in storage-core is Strict, we might need to cast.
            // For now, let's map body fields to record structure
            perturbationTracking: perturbations,
            metrics: body.metrics || { precision: 0, recall: 0, tp: 0, fp: 0, fn: 0 },
            moduleMetrics: body.moduleMetrics || {}
        } as any; // Cast as any because ValidationRecord definition might be strict

        ResultStorage.saveRecord(record, 'evaluation');

        return NextResponse.json({ success: true, id: record.id });
    } catch (error) {
        console.error("Failed to save evaluation:", error);
        return NextResponse.json({ error: "Failed to save evaluation" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
        }

        ResultStorage.deleteRecord(id, 'evaluation');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete evaluation:", error);
        return NextResponse.json({ error: "Failed to delete evaluation" }, { status: 500 });
    }
}
