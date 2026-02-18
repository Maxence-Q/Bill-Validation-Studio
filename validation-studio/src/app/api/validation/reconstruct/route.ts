import { NextRequest, NextResponse } from "next/server";
import { getRecordDetails } from "@/lib/validation/validation-orchestrator";

// Force dynamic since we might use dynamic imports or runtime logic
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { targetEventId, referenceIds, module, config, perturbationConfig } = body;

        if (!targetEventId || !referenceIds) {
            return NextResponse.json(
                { error: "Missing targetEventId or referenceIds" },
                { status: 400 }
            );
        }

        // Delegate entire process to the Orchestrator (Process 6.2)
        const prompts = await getRecordDetails({
            targetEventId,
            referenceIds,
            module,
            config,
            perturbationConfig
        });

        return NextResponse.json({ prompts });

    } catch (error: any) {
        console.error("Reconstruction error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to reconstruct prompts" },
            { status: 500 }
        );
    }
}
