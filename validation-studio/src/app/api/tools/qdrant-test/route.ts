import { NextRequest, NextResponse } from "next/server";
import { RetrievalService } from "@/lib/validation/orchestrator-modules/retrieval-service";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { eventId } = await request.json();

        if (!eventId) {
            return NextResponse.json({ error: "Event ID is required" }, { status: 400 });
        }

        const results = await RetrievalService.retrieveDetailedContext(parseInt(eventId), 4);
        return NextResponse.json({ results });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
