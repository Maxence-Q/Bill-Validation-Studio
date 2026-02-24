import { Button } from "@/components/ui/button"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { cn } from "@/lib/utils"

interface MetricsHeaderProps {
    record: ValidationRecord
}

export function MetricsHeader({ record }: MetricsHeaderProps) {
    if (!record.metrics) return null

    return (
        <div className="flex gap-4 text-sm mr-4 border-r pr-4">
            <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Precision</span>
                <span className="font-bold font-mono">{(record.metrics.precision * 100).toFixed(1)}%</span>
            </div>
            <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Recall</span>
                <span className="font-bold font-mono">{(record.metrics.recall * 100).toFixed(1)}%</span>
            </div>
        </div>
    )
}

interface TopBarProps {
    record: ValidationRecord
    activeModule: string
    setActiveModule: (module: string) => void
    onModuleChange: () => void
}

const EVALUATION_MODULES = [
    "Event", "EventDates", "OwnerPOS", "FeeDefinitions",
    "Prices", "PriceGroups", "RightToSellAndFees"
]

export function TopBar({ record, activeModule, setActiveModule, onModuleChange }: TopBarProps) {
    const modMetrics = record.moduleMetrics?.[activeModule] || (record.metrics as any)?.moduleMetrics?.[activeModule]

    return (
        <div className="flex justify-between items-center gap-4 w-full p-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide flex-1 px-2">
                {EVALUATION_MODULES.map(module => (
                    <Button
                        key={module}
                        variant={activeModule === module ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                            setActiveModule(module)
                            onModuleChange()
                        }}
                        className="shrink-0"
                    >
                        {module}
                    </Button>
                ))}
            </div>
            {modMetrics && (
                <div className="flex gap-3 text-sm px-3 py-1.5 mr-2 bg-background border rounded-md shadow-sm shrink-0 items-center animate-in fade-in slide-in-from-right-2 duration-300">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Precision</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {(modMetrics.precision * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div className="w-px h-3 bg-border"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Recall</span>
                        <span className="font-mono font-bold text-violet-600 dark:text-violet-400">
                            {(modMetrics.recall * 100).toFixed(1)}%
                        </span>
                    </div>
                    {(modMetrics.tp !== undefined) && (
                        <>
                            <div className="w-px h-3 bg-border"></div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground">({modMetrics.tp} TP)</span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
