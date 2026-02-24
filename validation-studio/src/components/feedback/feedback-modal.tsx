"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BrainCircuit, Loader2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { getFeedback, saveFeedback, generateFeedback, FeedbackData } from "@/app/actions/feedback"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface FeedbackModalProps {
    isOpen: boolean
    onClose: () => void
    record: ValidationRecord
    type: 'evaluation' | 'validation'
}

const ALL_MODULES = [
    "Event", "EventDates", "OwnerPOS", "FeeDefinitions",
    "Prices", "PriceGroups", "RightToSellAndFees"
]
const LIST_MODULES = ["Prices", "PriceGroups", "RightToSellAndFees"]

export function FeedbackModal({ isOpen, onClose, record, type }: FeedbackModalProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [isLoading, setIsLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState("")

    // Step 1 State
    const [selectedModules, setSelectedModules] = useState<Record<string, boolean>>(
        ALL_MODULES.reduce((acc, mod) => ({ ...acc, [mod]: true }), {})
    )
    const [moduleCounts, setModuleCounts] = useState<Record<string, number>>({})

    // Step 2 State
    const [progress, setProgress] = useState<{ module: string; index: number; total: number } | null>(null)

    // Step 3 State
    const [feedbackResults, setFeedbackResults] = useState<Record<string, string[]>>({})
    const [viewModule, setViewModule] = useState<string>(ALL_MODULES[0])
    const [viewIndex, setViewIndex] = useState(0)

    // Auto-detect list sizes from record
    useEffect(() => {
        if (!isOpen) return
        const counts: Record<string, number> = {}
        LIST_MODULES.forEach(mod => {
            const prompts = record.prompts?.[mod]
            if (Array.isArray(prompts)) {
                // Approximate grouping size or simply length
                counts[mod] = prompts.length || 1
            } else if (prompts) {
                counts[mod] = 1
            } else {
                counts[mod] = 5 // User default fallback
            }
        })
        setModuleCounts(counts)
    }, [isOpen, record])

    // Load existing feedback on open
    useEffect(() => {
        if (isOpen) {
            setStep(1)
            setFeedbackResults({})
            setErrorMsg("")
            const checkExisting = async () => {
                setIsLoading(true)
                try {
                    const existing = await getFeedback(record.eventId || record.targetEventId || "none", record.timestamp, type)
                    if (existing && Object.keys(existing.modules).length > 0) {
                        setFeedbackResults(existing.modules)
                        const firstMod = Object.keys(existing.modules)[0]
                        setViewModule(firstMod)
                        setViewIndex(0)
                        setStep(3)
                    }
                } catch (e) {
                    console.error("Failed to check existing feedback", e)
                } finally {
                    setIsLoading(false)
                }
            }
            checkExisting()
        }
    }, [isOpen, record, type])

    const getGroupedPromptsForModule = (moduleName: string) => {
        const modulePrompts = record.prompts?.[moduleName]
        if (!modulePrompts) return []

        const arr = Array.isArray(modulePrompts) ? modulePrompts : [modulePrompts]
        if (arr.length === 0) return []

        const normalized = arr.map((item: any, idx: number) => {
            if (typeof item === 'object' && item !== null && 'content' in item && 'parentIndex' in item) {
                return { content: item.content as string, parentIndex: item.parentIndex as number }
            }
            if (typeof item === 'object' && item !== null && 'slicingMetadata' in item) {
                const content = item.content || item.rendered || JSON.stringify(item, null, 2)
                return { content, parentIndex: item.slicingMetadata.parentIndex as number }
            }
            if (typeof item === 'string') {
                return { content: item, parentIndex: idx }
            }
            if (typeof item === 'object' && item !== null && 'content' in item) {
                return { content: item.content as string, parentIndex: idx }
            }
            return { content: JSON.stringify(item, null, 2), parentIndex: idx }
        })

        const grouped = new Map<number, string[]>()
        normalized.forEach(p => {
            const a = grouped.get(p.parentIndex) || []
            a.push(p.content)
            grouped.set(p.parentIndex, a)
        })

        return Array.from(grouped.entries())
            .sort(([a], [b]) => a - b)
            .map(([parentIndex, contents]) => ({
                content: contents.join("\\n\\n"),
                parentIndex
            }))
    }

    const handleGenerate = async () => {
        setIsLoading(true)
        setStep(2)
        setErrorMsg("")

        const results: Record<string, string[]> = {}
        const modsToProcess = ALL_MODULES.filter(m => selectedModules[m])

        try {
            for (const mod of modsToProcess) {
                const groupedPrompts = getGroupedPromptsForModule(mod)
                const isList = LIST_MODULES.includes(mod)
                const limit = isList ? (moduleCounts[mod] || 1) : 1

                const processCount = Math.min(limit, groupedPrompts.length || 1)
                const modResults: string[] = []

                for (let i = 0; i < processCount; i++) {
                    setProgress({ module: mod, index: i + 1, total: processCount })

                    const promptObj = groupedPrompts[i]
                    const promptText = promptObj?.content || "No prompt available"
                    const reasoning = record.reasonings?.[mod]?.[i] || "No reasoning available"

                    let issues = record.issues.filter((iss: any) => iss.module === mod)
                    if (isList && promptObj) {
                        issues = issues.filter((iss: any) => iss.itemIndex === promptObj.parentIndex)
                    }

                    if (issues.length === 0) {
                        modResults.push("No validation issues found for this item, so no feedback is needed.")
                        continue
                    }

                    const feedback = await generateFeedback(promptText, reasoning, issues)
                    modResults.push(feedback)
                }

                if (modResults.length > 0) {
                    results[mod] = modResults
                }
            }

            setFeedbackResults(results)
            await saveFeedback(record.eventId || record.targetEventId || "none", record.timestamp, type, results)

            const firstMod = Object.keys(results)[0]
            if (firstMod) {
                setViewModule(firstMod)
                setViewIndex(0)
            }
            setStep(3)

        } catch (e: any) {
            console.error(e)
            setErrorMsg(e.message || "Failed to generate feedback for one or more modules.")
            setStep(1) // Go back so user can retry
        } finally {
            setIsLoading(false)
            setProgress(null)
        }
    }

    const renderStep1 = () => (
        <div className="space-y-4">
            <div className="text-sm text-muted-foreground mb-4">
                Select the modules you want to get LLM feedback on. This will send the prompt, reasoning, and identified issues to analyze true/false positives.
            </div>
            {ALL_MODULES.map(mod => {
                const isList = LIST_MODULES.includes(mod)
                return (
                    <div key={mod} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id={`mod-${mod}`}
                                checked={selectedModules[mod] || false}
                                onCheckedChange={(c: any) => setSelectedModules(prev => ({ ...prev, [mod]: !!c }))}
                            />
                            <Label htmlFor={`mod-${mod}`} className="cursor-pointer font-medium">{mod}</Label>
                        </div>
                        {isList && selectedModules[mod] && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground mr-1">Count:</span>
                                <Input
                                    type="number"
                                    min={1}
                                    max={20}
                                    className="w-16 h-8 text-sm"
                                    value={moduleCounts[mod] || 1}
                                    onChange={(e) => setModuleCounts(prev => ({ ...prev, [mod]: parseInt(e.target.value) || 1 }))}
                                />
                            </div>
                        )}
                    </div>
                )
            })}
            {errorMsg && (
                <div className="p-3 bg-red-100 text-red-700 rounded text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}
            <DialogFooter className="mt-6">
                <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                <Button onClick={handleGenerate} disabled={isLoading || Object.values(selectedModules).every(v => !v)}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
                    Get LLM Feedback
                </Button>
            </DialogFooter>
        </div>
    )

    const renderStep2 = () => (
        <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
            <div className="relative">
                <BrainCircuit className="w-16 h-16 text-primary animate-pulse" />
                <Loader2 className="w-6 h-6 animate-spin absolute -bottom-2 -right-2 text-muted-foreground" />
            </div>
            <div>
                <h3 className="text-lg font-semibold">Generating AI Feedback</h3>
                <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
                    Sending prompts, reasoning, and issues to complete analysis. This may take a few moments.
                </p>
            </div>
            {progress && (
                <div className="bg-muted p-3 rounded-md w-full max-w-sm border text-sm">
                    <div className="font-medium text-primary">{progress.module}</div>
                    <div className="text-muted-foreground mt-1">Processing item {progress.index} of {progress.total}...</div>
                </div>
            )}
        </div>
    )

    const renderStep3 = () => {
        const availableMods = Object.keys(feedbackResults)
        if (availableMods.length === 0) {
            return (
                <div className="py-8 text-center text-muted-foreground">
                    No feedback available to display.
                </div>
            )
        }

        const currentFeedbackList = feedbackResults[viewModule] || []
        const currentFeedback = currentFeedbackList[viewIndex] || "No feedback found."

        return (
            <div className="flex flex-col flex-1 min-h-0 h-[75vh]">
                <div className="flex items-center justify-between border-b pb-2 mb-4 shrink-0 overflow-x-auto">
                    <div className="flex gap-1">
                        {availableMods.map(mod => (
                            <Button
                                key={mod}
                                variant={viewModule === mod ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => { setViewModule(mod); setViewIndex(0); }}
                                className="text-xs"
                            >
                                {mod}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between bg-muted/30 p-2 rounded-t-md border-x border-t shrink-0">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                        <BrainCircuit className="w-4 h-4 text-primary" />
                        {viewModule} Feedback
                    </h4>
                    {currentFeedbackList.length > 1 && (
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6"
                                disabled={viewIndex === 0}
                                onClick={() => setViewIndex(viewIndex - 1)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs tabular-nums text-muted-foreground min-w-[3rem] text-center">
                                {viewIndex + 1} of {currentFeedbackList.length}
                            </span>
                            <Button variant="ghost" size="icon" className="h-6 w-6"
                                disabled={viewIndex >= currentFeedbackList.length - 1}
                                onClick={() => setViewIndex(viewIndex + 1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex-1 border rounded-b-md bg-muted/10 min-h-0 w-full overflow-y-auto custom-scrollbar">
                    <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {currentFeedback}
                        </ReactMarkdown>
                    </div>
                </div>

                <div className="mt-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center text-green-600 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Feedback Saved
                    </div>
                    <Button onClick={onClose}>Close</Button>
                </div>
            </div>
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && !isLoading && onClose()}>
            <DialogContent className="max-w-[95vw] md:max-w-5xl lg:max-w-6xl xl:max-w-[1400px] max-h-[95vh] flex flex-col" onInteractOutside={(e) => isLoading && e.preventDefault()}>
                <DialogHeader className="shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-primary" />
                        LLM Validation Feedback
                    </DialogTitle>
                </DialogHeader>
                {isLoading && step === 1 ? (
                    <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : (
                    <>
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
