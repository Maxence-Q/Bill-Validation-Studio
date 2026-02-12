import { NextRequest, NextResponse } from "next/server";
import { ValidationRecord } from "@/lib/configuration/storage-core";
import { EvaluationStorage } from "@/lib/evaluation/storage";
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
    try {
        const history = await EvaluationStorage.getHistory();
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
            perturbations: perturbations || {},
            metrics: body.metrics || { precision: 0, recall: 0, tp: 0, fp: 0, fn: 0 },
            moduleMetrics: body.moduleMetrics || {}
        };

        await EvaluationStorage.saveEvaluation(record);

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

        await EvaluationStorage.deleteEvaluation(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete evaluation:", error);
        return NextResponse.json({ error: "Failed to delete evaluation" }, { status: 500 });
    }
}
