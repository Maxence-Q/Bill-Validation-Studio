"use client"

import { CheckCircle2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Configuration } from "@/types/configuration"

interface ConfigSelectorProps {
    configs: Configuration[]
    selectedConfig: Configuration | null
    onSelect: (config: Configuration) => void
    onNewConfig: () => void
}

export function ConfigSelector({ configs, selectedConfig, onSelect, onNewConfig }: ConfigSelectorProps) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Select Configuration</h3>
                    <p className="text-muted-foreground text-sm">
                        Choose an LLM parameter set for this evaluation.
                    </p>
                </div>
                <Button onClick={onNewConfig} variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" /> New Config
                </Button>
            </div>

            {configs.length === 0 ? (
                <div className="border-2 border-dashed rounded-xl p-8 text-center text-muted-foreground">
                    No configurations found. Create one to proceed.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {configs.map(config => (
                        <div
                            key={config.id}
                            onClick={() => onSelect(config)}
                            className={`
                                cursor-pointer transition-all border rounded-lg p-4 hover:border-primary/50 hover:bg-muted/5
                                ${selectedConfig?.id === config.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'}
                            `}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="font-medium truncate">{config.name}</div>
                                {selectedConfig?.id === config.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                            </div>
                            <div className="text-xs space-y-1 text-muted-foreground">
                                <div className="flex justify-between">
                                    <span>Model:</span>
                                    <span className="font-mono">{config.model}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Temp:</span>
                                    <span className="font-mono">{config.temperature}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Ref:</span>
                                    <span className="font-mono">{config.references}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
