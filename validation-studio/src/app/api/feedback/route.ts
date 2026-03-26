import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FEEDBACK_FILE = path.join(process.cwd(), "data", "operator_feedback.jsonl");

interface FeedbackEntry {
    issueId: string;
    module: string;
    message: string;
    severity: string;
    action: "fixed" | "dismissed";
    timestamp: string;
}

export async function POST(req: NextRequest) {
    try {
        const body: FeedbackEntry = await req.json();

        if (!body.issueId || !body.action) {
            return NextResponse.json({ error: "Missing issueId or action" }, { status: 400 });
        }

        const entry: FeedbackEntry = {
            issueId: body.issueId,
            module: body.module,
            message: body.message,
            severity: body.severity,
            action: body.action,
            timestamp: new Date().toISOString(),
        };

        // Ensure data directory exists
        const dir = path.dirname(FEEDBACK_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Append as JSONL
        fs.appendFileSync(FEEDBACK_FILE, JSON.stringify(entry) + "\n", "utf-8");

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Feedback API error:", error);
        return NextResponse.json(
            { error: "Failed to save feedback" },
            { status: 500 }
        );
    }
}
