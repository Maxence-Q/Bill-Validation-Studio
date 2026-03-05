import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DialogFooter } from "@/components/ui/dialog"
import { AlertCircle, CheckSquare, Square, ArrowRight } from "lucide-react"

export const ALL_MODULES = [
    "Event", "EventDates", "OwnerPOS", "FeeDefinitions",
    "Prices", "PriceGroups", "RightToSellAndFees"
]
export const LIST_MODULES = ["Prices", "PriceGroups", "RightToSellAndFees"]

interface Step1SelectionProps {
    selectedModules: Record<string, boolean>
    setSelectedModules: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    moduleCounts: Record<string, number>
    setModuleCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>
    errorMsg: string
    isLoading: boolean
    onClose: () => void
    onForward: () => void
}

export function Step1Selection({
    selectedModules,
    setSelectedModules,
    moduleCounts,
    setModuleCounts,
    errorMsg,
    isLoading,
    onClose,
    onForward
}: Step1SelectionProps) {
    const handleToggleAll = (checked: boolean) => {
        const newState = ALL_MODULES.reduce((acc, mod) => ({ ...acc, [mod]: checked }), {})
        setSelectedModules(newState)
    }

    const isAllChecked = ALL_MODULES.every(mod => selectedModules[mod])
    const isNoneChecked = ALL_MODULES.every(mod => !selectedModules[mod])

    return (
        <div className="space-y-4 flex flex-col flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <div className="text-sm text-muted-foreground flex-1">
                    Select the modules you want to get LLM feedback on. This will send the prompt, reasoning, and identified issues to analyze true/false positives.
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleAll(true)}
                        disabled={isAllChecked || isLoading}
                        className="h-8 text-xs"
                    >
                        <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                        Check All
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleAll(false)}
                        disabled={isNoneChecked || isLoading}
                        className="h-8 text-xs"
                    >
                        <Square className="w-3.5 h-3.5 mr-1.5" />
                        Uncheck All
                    </Button>
                </div>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto">
                {ALL_MODULES.map(mod => {
                    const isList = LIST_MODULES.includes(mod)
                    return (
                        <div key={mod} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id={`mod-${mod}`}
                                    checked={selectedModules[mod] || false}
                                    onCheckedChange={(c: boolean) => setSelectedModules(prev => ({ ...prev, [mod]: !!c }))}
                                    disabled={isLoading}
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
                                        disabled={isLoading}
                                        className="w-16 h-8 text-sm"
                                        value={moduleCounts[mod] || 1}
                                        onChange={(e) => setModuleCounts(prev => ({ ...prev, [mod]: parseInt(e.target.value) || 1 }))}
                                    />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {errorMsg && (
                <div className="p-3 bg-red-100 text-red-700 rounded text-sm flex items-start gap-2 shrink-0 border border-red-200">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}

            <DialogFooter className="mt-4 pt-4 border-t shrink-0">
                <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                <Button onClick={onForward} disabled={isLoading || isNoneChecked}>
                    Forward <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </DialogFooter>
        </div>
    )
}

