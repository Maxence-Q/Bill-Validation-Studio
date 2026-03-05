import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { BrainCircuit, Loader2, ArrowLeft, Target } from "lucide-react"
import { FEEDBACK_GOALS } from "@/app/actions/feedback-prompts"

interface Step2GoalsProps {
    selectedGoalId: string
    setSelectedGoalId: (id: string) => void
    isLoading: boolean
    onBack: () => void
    onGenerate: () => void
}

export function Step2Goals({
    selectedGoalId,
    setSelectedGoalId,
    isLoading,
    onBack,
    onGenerate
}: Step2GoalsProps) {
    return (
        <div className="space-y-4 flex flex-col flex-1 h-full min-h-0">
            <div className="text-sm text-muted-foreground shrink-0 px-1">
                Select an objective to focus the LLM analysis. This determines the instructions sent to evaluate the prompts and issues.
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 px-1 pb-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {FEEDBACK_GOALS.map((goal) => {
                        const isSelected = selectedGoalId === goal.id
                        return (
                            <div
                                key={goal.id}
                                onClick={() => !isLoading && setSelectedGoalId(goal.id)}
                                className={`
                                    relative flex flex-col p-4 rounded-xl border-2 transition-all duration-200 text-left
                                    ${isLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:shadow-md"}
                                    ${isSelected
                                        ? "border-primary bg-primary/5 shadow-sm"
                                        : "border-muted hover:border-primary/50"}
                                `}
                            >
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="font-semibold text-foreground flex items-center gap-2">
                                        <Target className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                        {goal.title}
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5
                                        ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'}`}
                                    >
                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
                                    </div>
                                </div>
                                <div className="text-sm text-muted-foreground leading-relaxed">
                                    {goal.description}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <DialogFooter className="mt-4 pt-4 border-t shrink-0">
                <Button variant="outline" onClick={onBack} disabled={isLoading}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button onClick={onGenerate} disabled={isLoading || !selectedGoalId}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BrainCircuit className="w-4 h-4 mr-2" />}
                    Get LLM Feedback
                </Button>
            </DialogFooter>
        </div>
    )
}
