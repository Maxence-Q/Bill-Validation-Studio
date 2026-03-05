import { Loader2, BrainCircuit } from "lucide-react"

interface Step2GeneratingProps {
    progress: { module: string; index: number; total: number } | null
}

export function Step2Generating({ progress }: Step2GeneratingProps) {
    return (
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
}
