import { NextRequest, NextResponse } from "next/server";
import { ValidationRecord } from "@/lib/configuration/storage-core";
import { ResultStorage } from "@/lib/validation/orchestrator-modules/result-storage";
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
    try {
        const history = ResultStorage.getHistory('validation');
        return NextResponse.json(history);
    } catch (error) {
        console.error("Failed to fetch history:", error);
        return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { eventId, eventName, status, issues, prompts } = body;

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
            prompts: prompts || {}
        };

        ResultStorage.saveRecord(record, 'validation');

        return NextResponse.json({ success: true, id: record.id });
    } catch (error) {
        console.error("Failed to save validation:", error);
        return NextResponse.json({ error: "Failed to save validation" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
        }

        ResultStorage.deleteRecord(id, 'validation');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete validation:", error);
        return NextResponse.json({ error: "Failed to delete validation" }, { status: 500 });
    }
}
