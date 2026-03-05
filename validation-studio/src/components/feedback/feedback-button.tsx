import { Button } from "@/components/ui/button"
import { BrainCircuit } from "lucide-react"
import { cn } from "@/lib/utils"

interface FeedbackButtonProps {
    onClick: () => void
    className?: string
}

export function FeedbackButton({ onClick, className }: FeedbackButtonProps) {
    return (
        <Button
            size="sm"
            className={cn(
                "h-8 flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02]",
                className
            )}
            onClick={onClick}
        >
            <BrainCircuit className="w-4 h-4" />
            <span className="font-bold text-xs">Get Feedback</span>
        </Button>
    )
}
