import { NextRequest, NextResponse } from "next/server";
import { validateEvent } from "@/lib/validation/validation-orchestrator";

// Force dynamic since we use ReadableStream
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { targetEvent, config, perturbationConfig } = body;

        if (!targetEvent) {
            return NextResponse.json({ error: "Missing targetEvent" }, { status: 400 });
        }

        if (!config) {
            return NextResponse.json({ error: "Missing config" }, { status: 400 });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const send = (data: import("@/types/validation").StreamMessage) => controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));

                try {
                    const result = await validateEvent({
                        targetEvent,
                        config,
                        perturbationConfig,
                        onProgress: (progress) => {
                            // Ensure granular progress is sent
                            send({
                                type: "progress",
                                module: progress.module,
                                current: progress.current,
                                total: progress.total,
                                status: progress.status,
                                global: progress.global
                            });
                        },
                        onStart: (totalModules) => {
                            send({ type: "start", totalModules });
                        },
                        onModuleComplete: (module, issues, totalModules) => {
                            send({
                                type: "module_complete",
                                module,
                                issues: issues as import("@/types/validation").ValidationIssue[],
                                totalModules
                            });
                        },
                        storage: {
                            type: body.storageType || 'evaluation'
                        }
                    });

                    send({
                        type: "result",
                        message: "Evaluation complete",
                        issues: result.issues as import("@/types/validation").ValidationIssue[],
                        prompts: result.prompts,
                        metrics: result.metrics,
                        reasonings: result.reasonings
                    });
                } catch (err: any) {
                    console.error("Orchestrator error:", err);
                    send({ type: "error", message: err.message || "Evaluation failed" });
                } finally {
                    controller.close();
                }
            }
        });

        return new NextResponse(stream, {
            headers: {
                "Content-Type": "application/x-ndjson",
                "Transfer-Encoding": "chunked"
            }
        });

    } catch (error) {
        console.error("API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
