import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

export interface PromptViewerProps {
    promptText: string | null
    highlightedLine: number | null
}

export function PromptViewer({
    promptText,
    highlightedLine
}: PromptViewerProps) {

    // Scroll to highlighted line
    useEffect(() => {
        if (highlightedLine !== null) {
            const timeoutId = setTimeout(() => {
                const element = document.getElementById(`prompt-line-${highlightedLine}`)
                if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "center" })
                }
            }, 100)
            return () => clearTimeout(timeoutId)
        }
    }, [highlightedLine])

    if (!promptText) {
        return (
            <div className="flex-1 p-4 flex items-center justify-center text-muted-foreground italic">
                No prompt available.
            </div>
        )
    }

    return (
        <ScrollArea className="flex-1 w-full h-full min-h-0 bg-muted/5">
            <div className="p-4 min-w-max">
                <div className="font-mono text-xs whitespace-pre bg-transparent">
                    {promptText.split('\n').map((line, idx) => (
                        <div
                            key={idx}
                            id={`prompt-line-${idx}`}
                            className={cn(
                                "px-1 min-h-[1.2rem] rounded-sm transition-colors w-fit min-w-full flex",
                                highlightedLine === idx
                                    ? "bg-yellow-200/50 dark:bg-yellow-900/50 text-foreground font-medium"
                                    : "hover:bg-muted/50 text-muted-foreground"
                            )}
                        >
                            <span className="inline-block w-8 shrink-0 text-muted-foreground/50 select-none mr-2 border-r pr-2 text-right">
                                {idx + 1}
                            </span>
                            <span>{line || " "}</span>
                        </div>
                    ))}
                </div>
            </div>
            <ScrollBar orientation="horizontal" />
            <ScrollBar orientation="vertical" />
        </ScrollArea>
    )
}
