import { ScrollArea } from "@/components/ui/scroll-area"
import { BrainCircuit } from "lucide-react"

interface ReasoningViewerProps {
    reasoning: string | null | undefined
}

/**
 * Renders a single reasoning string as readable prose.
 * Used in the Advanced view alongside PromptViewer and the Issues panel.
 */
export function ReasoningViewer({ reasoning }: ReasoningViewerProps) {
    if (!reasoning) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
                <BrainCircuit className="h-8 w-8 opacity-30" />
                <p className="text-sm italic text-center">
                    No reasoning available for this item.<br />
                    <span className="text-xs opacity-70">The model may not have emitted a reasoning trace.</span>
                </p>
            </div>
        )
    }

    return (
        <ScrollArea className="flex-1 w-full h-full min-h-0 bg-muted/5">
            <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                {reasoning.split("\n").map((para, idx) =>
                    para.trim() === "" ? (
                        <div key={idx} className="h-3" />
                    ) : (
                        <p key={idx} className="text-xs leading-relaxed text-foreground/80 mb-0">
                            {para}
                        </p>
                    )
                )}
            </div>
        </ScrollArea>
    )
}
