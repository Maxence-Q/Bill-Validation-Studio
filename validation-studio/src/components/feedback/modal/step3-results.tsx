import { useState } from "react"
import { Button } from "@/components/ui/button"
import { BrainCircuit, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { ALL_MODULES } from "./step1-selection"

interface Step3ResultsProps {
    feedbackResults: Record<string, string[]>
    onClose: () => void
}

export function Step3Results({ feedbackResults, onClose }: Step3ResultsProps) {
    const [viewModule, setViewModule] = useState<string>(Object.keys(feedbackResults)[0] || ALL_MODULES[0])
    const [viewIndex, setViewIndex] = useState(0)

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
            <div className="flex items-center justify-between border-b pb-3 mb-4 shrink-0 overflow-x-auto">
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

            <div className="flex items-center justify-between bg-muted/30 p-2.5 rounded-t-md border-x border-t shrink-0">
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
                <div className="p-5 prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {currentFeedback}
                    </ReactMarkdown>
                </div>
            </div>

            <div className="mt-6 pt-4 border-t flex justify-between items-center shrink-0">
                <div className="flex items-center text-green-600 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Feedback Saved
                </div>
                <Button onClick={onClose}>Close</Button>
            </div>
        </div>
    )
}
