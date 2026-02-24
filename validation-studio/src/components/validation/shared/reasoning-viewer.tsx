import { useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BrainCircuit } from "lucide-react"
import { cn } from "@/lib/utils"

interface ReasoningViewerProps {
    reasoning: string | null | undefined
    highlightedLine?: number | null
}

/**
 * Renders a single reasoning string as readable prose.
 * Used in the Advanced view alongside PromptViewer and the Issues panel.
 */
export function ReasoningViewer({ reasoning, highlightedLine }: ReasoningViewerProps) {
    // Scroll to highlighted line
    useEffect(() => {
        if (highlightedLine !== null && highlightedLine !== undefined) {
            const timeoutId = setTimeout(() => {
                const element = document.getElementById(`reasoning-line-${highlightedLine}`)
                if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "center" })
                }
            }, 100)
            return () => clearTimeout(timeoutId)
        }
    }, [highlightedLine])

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
                        <div key={idx} id={`reasoning-line-${idx}`} className="h-3" />
                    ) : (
                        <p
                            key={idx}
                            id={`reasoning-line-${idx}`}
                            className={cn(
                                "text-xs leading-relaxed mb-0 p-1 rounded-sm transition-colors",
                                highlightedLine === idx
                                    ? "bg-yellow-200/50 dark:bg-yellow-900/50 text-foreground font-medium"
                                    : "text-foreground/80"
                            )}
                        >
                            {para}
                        </p>
                    )
                )}
            </div>
        </ScrollArea>
    )
}
