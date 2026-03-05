"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogHeader,
} from "@/components/ui/dialog";
import { BrainCircuit, Loader2 } from "lucide-react";
import { ValidationRecord } from "@/lib/configuration/storage-core";
import {
    getFeedback,
    saveFeedback,
    generateFeedback,
} from "@/app/actions/feedback";
import { getGoalById } from "@/app/actions/feedback-prompts";

import {
    Step1Selection,
    ALL_MODULES,
    LIST_MODULES,
} from "./modal/step1-selection";
import { Step2Goals } from "./modal/step2-goals";
import { Step2Generating } from "./modal/step2-generating";
import { Step3Results } from "./modal/step3-results";

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: ValidationRecord;
    type: "evaluation" | "validation";
}

export function FeedbackModal({
    isOpen,
    onClose,
    record,
    type,
}: FeedbackModalProps) {
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1=Selection, 2=Goals, 3=Generating, 4=Results
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Step 1 State
    const [selectedModules, setSelectedModules] = useState<
        Record<string, boolean>
    >(ALL_MODULES.reduce((acc, mod) => ({ ...acc, [mod]: true }), {}));
    const [moduleCounts, setModuleCounts] = useState<Record<string, number>>({});

    // Step 2 State
    const [selectedGoalId, setSelectedGoalId] = useState<string>("O1");

    // Step 3 State
    const [progress, setProgress] = useState<{
        module: string;
        index: number;
        total: number;
    } | null>(null);

    // Step 4 State
    const [feedbackResults, setFeedbackResults] = useState<
        Record<string, string[]>
    >({});

    // Auto-detect list sizes from record
    useEffect(() => {
        if (!isOpen) return;
        const counts: Record<string, number> = {};
        LIST_MODULES.forEach((mod) => {
            const prompts = record.prompts?.[mod];
            if (Array.isArray(prompts)) {
                counts[mod] = prompts.length || 1;
            } else if (prompts) {
                counts[mod] = 1;
            } else {
                counts[mod] = 5; // User default fallback
            }
        });
        setModuleCounts(counts);
    }, [isOpen, record]);

    // Load existing feedback on open
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setFeedbackResults({});
            setErrorMsg("");
            const checkExisting = async () => {
                setIsLoading(true);
                try {
                    const existing = await getFeedback(
                        record.eventId || record.targetEventId || "none",
                        record.timestamp,
                        type,
                    );
                    if (existing && Object.keys(existing.modules).length > 0) {
                        setFeedbackResults(existing.modules);
                        setStep(4); // Skip to Results
                    }
                } catch (e) {
                    console.error("Failed to check existing feedback", e);
                } finally {
                    setIsLoading(false);
                }
            };
            checkExisting();
        }
    }, [isOpen, record, type]);

    const getGroupedPromptsForModule = (moduleName: string) => {
        const modulePrompts = record.prompts?.[moduleName];
        if (!modulePrompts) return [];

        const arr = Array.isArray(modulePrompts) ? modulePrompts : [modulePrompts];
        if (arr.length === 0) return [];

        const normalized = arr.map((item: any, idx: number) => {
            if (
                typeof item === "object" &&
                item !== null &&
                "content" in item &&
                "parentIndex" in item
            ) {
                return {
                    content: item.content as string,
                    parentIndex: item.parentIndex as number,
                };
            }
            if (
                typeof item === "object" &&
                item !== null &&
                "slicingMetadata" in item
            ) {
                const content =
                    item.content || item.rendered || JSON.stringify(item, null, 2);
                return {
                    content,
                    parentIndex: item.slicingMetadata.parentIndex as number,
                };
            }
            if (typeof item === "string") {
                return { content: item, parentIndex: idx };
            }
            if (typeof item === "object" && item !== null && "content" in item) {
                return { content: item.content as string, parentIndex: idx };
            }
            return { content: JSON.stringify(item, null, 2), parentIndex: idx };
        });

        const grouped = new Map<number, string[]>();
        normalized.forEach((p) => {
            const a = grouped.get(p.parentIndex) || [];
            a.push(p.content);
            grouped.set(p.parentIndex, a);
        });

        return Array.from(grouped.entries())
            .sort(([a], [b]) => a - b)
            .map(([parentIndex, contents]) => ({
                content: contents.join("\\n\\n"),
                parentIndex,
            }));
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setStep(3);
        setErrorMsg("");

        const goal = getGoalById(selectedGoalId);
        const results: Record<string, string[]> = {};
        const modsToProcess = ALL_MODULES.filter((m) => selectedModules[m]);

        try {
            for (const mod of modsToProcess) {
                const groupedPrompts = getGroupedPromptsForModule(mod);
                const isList = LIST_MODULES.includes(mod);
                const limit = isList ? moduleCounts[mod] || 1 : 1;

                const processCount = Math.min(limit, groupedPrompts.length || 1);
                const modResults: string[] = [];

                for (let i = 0; i < processCount; i++) {
                    setProgress({ module: mod, index: i + 1, total: processCount });

                    const promptObj = groupedPrompts[i];
                    const promptText = promptObj?.content || "No prompt available";
                    const reasoning =
                        record.reasonings?.[mod]?.[i] || "No reasoning available";

                    let issues = record.issues.filter((iss: any) => iss.module === mod);
                    if (isList && promptObj) {
                        issues = issues.filter(
                            (iss: any) => iss.itemIndex === promptObj.parentIndex,
                        );
                    }

                    if (issues.length === 0) {
                        modResults.push(
                            "No validation issues found for this item, so no feedback is needed.",
                        );
                        continue;
                    }

                    // Remove TP/FP/FN properties if in evaluation mode and goal is O1
                    let cleanIssues = issues;
                    if (type === "evaluation" && goal.id === "O1") {
                        cleanIssues = issues.map((iss: any) => {
                            const newIss = { ...iss };
                            delete newIss.TP;
                            delete newIss.FP;
                            delete newIss.FN;
                            return newIss;
                        });
                    }

                    const errorsText =
                        typeof (cleanIssues as any) === "string"
                            ? cleanIssues
                            : JSON.stringify(cleanIssues, null, 2);

                    const systemPrompt = goal.systemPrompt;
                    const userPrompt = goal.getUserPrompt(
                        promptText,
                        reasoning,
                        errorsText as string,
                    );

                    const feedback = await generateFeedback(systemPrompt, userPrompt);
                    modResults.push(feedback);
                }

                if (modResults.length > 0) {
                    results[mod] = modResults;
                }
            }

            setFeedbackResults(results);
            await saveFeedback(
                record.eventId || record.targetEventId || "none",
                record.timestamp,
                type,
                results,
            );
            setStep(4);
        } catch (e: any) {
            console.error(e);
            setErrorMsg(
                e.message || "Failed to generate feedback for one or more modules.",
            );
            setStep(2); // Go back so user can retry
        } finally {
            setIsLoading(false);
            setProgress(null);
        }
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => !open && !isLoading && onClose()}
        >
            <DialogContent
                className="max-w-[95vw] md:max-w-4xl lg:max-w-6xl xl:max-w-[1400px] w-full max-h-[95vh] h-full sm:h-[90vh] flex flex-col p-6"
                onInteractOutside={(e) => isLoading && e.preventDefault()}
            >
                <DialogHeader className="shrink-0 mb-4 px-1">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <BrainCircuit className="w-6 h-6 text-primary" />
                        LLM Validation Feedback
                        {step === 1 && (
                            <span className="text-muted-foreground font-normal ml-2">
                                - Step 1: Select Modules
                            </span>
                        )}
                        {step === 2 && (
                            <span className="text-muted-foreground font-normal ml-2">
                                - Step 2: Select Goal
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    {isLoading && (step === 1 || step === 2) ? (
                        <div className="py-24 flex justify-center flex-1 items-center">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            {step === 1 && (
                                <Step1Selection
                                    selectedModules={selectedModules}
                                    setSelectedModules={setSelectedModules}
                                    moduleCounts={moduleCounts}
                                    setModuleCounts={setModuleCounts}
                                    errorMsg={errorMsg}
                                    isLoading={isLoading}
                                    onClose={onClose}
                                    onForward={() => setStep(2)}
                                />
                            )}
                            {step === 2 && (
                                <Step2Goals
                                    selectedGoalId={selectedGoalId}
                                    setSelectedGoalId={setSelectedGoalId}
                                    isLoading={isLoading}
                                    onBack={() => setStep(1)}
                                    onGenerate={handleGenerate}
                                />
                            )}
                            {step === 3 && <Step2Generating progress={progress} />}
                            {step === 4 && (
                                <Step3Results
                                    feedbackResults={feedbackResults}
                                    onClose={onClose}
                                />
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
