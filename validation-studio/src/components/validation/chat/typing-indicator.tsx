import { Bot } from "lucide-react"

export function TypingIndicator() {
    return (
        <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-muted/60 backdrop-blur-sm rounded-2xl rounded-tl-sm px-4 py-3 border border-border/50">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
            </div>
        </div>
    )
}
