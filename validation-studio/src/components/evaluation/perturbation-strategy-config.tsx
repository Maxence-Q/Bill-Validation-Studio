import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { ChevronDown, ChevronRight, Info } from "lucide-react"

export interface PerturbationStrategyConfigProps {
    onConfirm: (config: any) => void;
}

const MODULES = ["Event", "OwnerPOS", "EventDates", "FeeDefinitions", "PriceGroups", "Prices", "RightToSellAndFees"];
const ATTRIBUTE_TYPES = ["String", "Integer", "Float", "Boolean", "Date", "UUID"];

export function PerturbationStrategyConfig({ onConfirm }: PerturbationStrategyConfigProps) {
    // Section 1: Modules
    const [moduleSelectionMode, setModuleSelectionMode] = useState<'all' | 'custom'>('all');
    const [selectedModules, setSelectedModules] = useState<string[]>(MODULES);

    // Section 2: Percentages
    const [percentageMode, setPercentageMode] = useState<'all' | 'custom'>('all');
    const [globalPercentage, setGlobalPercentage] = useState<number[]>([10, 20]); // Min, Max
    const [modulePercentages, setModulePercentages] = useState<Record<string, number[]>>({});

    // Section 3: Advanced
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [selectedAttributeTypes, setSelectedAttributeTypes] = useState<string[]>(ATTRIBUTE_TYPES);

    // Initialize module percentages when modules change
    useEffect(() => {
        const newPercentages = { ...modulePercentages };
        let changed = false;
        MODULES.forEach(m => {
            if (!newPercentages[m]) {
                newPercentages[m] = [10, 20];
                changed = true;
            }
        });
        if (changed) setModulePercentages(newPercentages);
    }, []);

    // Helper to handle module checkboxes
    const toggleModule = (module: string) => {
        setSelectedModules(prev =>
            prev.includes(module)
                ? prev.filter(m => m !== module)
                : [...prev, module]
        );
    };

    // Helper to handle attribute types
    const toggleAttributeType = (type: string) => {
        setSelectedAttributeTypes(prev =>
            prev.includes(type)
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    const handleConfirm = () => {
        onConfirm({
            moduleSelectionMode,
            selectedModules: moduleSelectionMode === 'all' ? MODULES : selectedModules,
            percentageMode,
            globalPercentage,
            modulePercentages,
            selectedAttributeTypes
        });
    };

    // Derived state for section 2 modules
    const activeModules = (moduleSelectionMode === 'all' ? MODULES : selectedModules)
        .filter(m => MODULES.includes(m));

    // Helper to format percentage range
    const formatRange = (range: number[]) => {
        return range ? `${range[0]}% - ${range[1]}%` : "10% - 20%";
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Perturbation Strategy</h3>
                    <p className="text-muted-foreground text-sm">
                        Configure how the prompts should be modified.
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                {/* ----------------------------------------------------------------------------------
                    SECTION 1: MODULES SELECTION
                   ---------------------------------------------------------------------------------- */}
                <Card className="border-muted bg-muted/5">
                    <CardHeader className="pb-3 pt-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                            Target Modules
                        </CardTitle>
                        <CardDescription>Select which data modules should be perturbed.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    id="modules-all"
                                    name="module-mode"
                                    checked={moduleSelectionMode === 'all'}
                                    onChange={() => setModuleSelectionMode('all')}
                                    className="h-4 w-4 border-primary text-primary focus:ring-primary accent-primary"
                                />
                                <Label htmlFor="modules-all" className="cursor-pointer font-normal">
                                    All Modules (Default)
                                </Label>
                            </div>
                            <div className="flex flex-col space-y-2">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="modules-custom"
                                        name="module-mode"
                                        checked={moduleSelectionMode === 'custom'}
                                        onChange={() => setModuleSelectionMode('custom')}
                                        className="h-4 w-4 border-primary text-primary focus:ring-primary accent-primary"
                                    />
                                    <Label htmlFor="modules-custom" className="cursor-pointer font-normal">
                                        Custom Selection
                                    </Label>
                                </div>

                                {moduleSelectionMode === 'custom' && (
                                    <div className="pl-6 mt-1 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                        {MODULES.map(module => (
                                            <div key={module} className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id={`module-${module}`}
                                                    checked={selectedModules.includes(module)}
                                                    onChange={() => toggleModule(module)}
                                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                                                />
                                                <label htmlFor={`module-${module}`} className="text-sm cursor-pointer select-none">
                                                    {module}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ----------------------------------------------------------------------------------
                    SECTION 2: PERTURBATION DENSITY
                   ---------------------------------------------------------------------------------- */}
                <Card className="border-muted bg-muted/5">
                    <CardHeader className="pb-3 pt-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                            Perturbation Density
                        </CardTitle>
                        <CardDescription>Define the percentage of attributes to modify per module.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col gap-3">
                            {/* Global Range Mode */}
                            <div className="flex flex-col space-y-2">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="density-all"
                                        name="density-mode"
                                        checked={percentageMode === 'all'}
                                        onChange={() => setPercentageMode('all')}
                                        className="h-4 w-4 border-primary text-primary focus:ring-primary accent-primary"
                                    />
                                    <Label htmlFor="density-all" className="cursor-pointer font-normal">
                                        Global Setting (Apply to all selected modules)
                                    </Label>
                                </div>

                                {percentageMode === 'all' && (
                                    <div className="pl-6 w-full sm:max-w-[300px] animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="flex justify-between text-xs text-muted-foreground mb-3">
                                            <span>Min: {globalPercentage[0]}%</span>
                                            <span>Max: {globalPercentage[1]}%</span>
                                        </div>
                                        <Slider
                                            defaultValue={[10, 20]}
                                            value={globalPercentage}
                                            max={100}
                                            step={5}
                                            minStepsBetweenThumbs={1}
                                            onValueChange={(val) => setGlobalPercentage(val)}
                                            className="w-full"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Custom Per-Module Mode */}
                            <div className="flex flex-col space-y-2">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="density-custom"
                                        name="density-mode"
                                        checked={percentageMode === 'custom'}
                                        onChange={() => setPercentageMode('custom')}
                                        className="h-4 w-4 border-primary text-primary focus:ring-primary accent-primary"
                                    />
                                    <Label htmlFor="density-custom" className="cursor-pointer font-normal">
                                        Custom Density Per Module
                                    </Label>
                                </div>

                                {percentageMode === 'custom' && (
                                    <div className="pl-6 mt-2 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                        {activeModules.length === 0 ? (
                                            <div className="text-sm text-amber-500 italic">No modules selected in Section 1.</div>
                                        ) : (
                                            activeModules.map(module => (
                                                <div key={module} className="grid grid-cols-[140px_90px_1fr] sm:grid-cols-[200px_100px_300px] gap-2 sm:gap-4 items-center">
                                                    <span className="text-sm font-medium truncate" title={module}>{module}</span>
                                                    <span className="text-xs text-muted-foreground font-mono">{formatRange(modulePercentages[module])}</span>
                                                    <Slider
                                                        defaultValue={[10, 20]}
                                                        value={modulePercentages[module] || [10, 20]}
                                                        max={100}
                                                        step={5}
                                                        minStepsBetweenThumbs={1}
                                                        onValueChange={(val) => setModulePercentages(prev => ({ ...prev, [module]: val }))}
                                                        className="w-full"
                                                    />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ----------------------------------------------------------------------------------
                    SECTION 3: PERTURBATION FUNCTIONS (Visual Only)
                   ---------------------------------------------------------------------------------- */}
                <Card className="border-muted bg-muted/5">
                    <div
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/10 transition-colors"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <span className="bg-primary/10 text-primary w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                                Perturbation Functions
                                <span className="text-[10px] font-normal text-muted-foreground bg-muted border ml-2 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Advanced configuration</span>
                            </CardTitle>
                        </div>
                        {showAdvanced ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>

                    {showAdvanced && (
                        <CardContent className="pt-0 border-t animate-in slide-in-from-top-1 duration-200">
                            <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {ATTRIBUTE_TYPES.map(type => (
                                    <div key={type} className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id={`attr-${type}`}
                                            checked={selectedAttributeTypes.includes(type)}
                                            onChange={() => toggleAttributeType(type)}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                                        />
                                        <label htmlFor={`attr-${type}`} className="text-sm cursor-pointer select-none">
                                            {type}
                                        </label>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md flex gap-3 items-start">
                                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-muted-foreground">
                                    Selected types will be eligible for perturbation. Unchecking a type will preserve all values of that type across selected modules.
                                </p>
                            </div>
                        </CardContent>
                    )}
                </Card>

            </div>

            <div className="flex justify-end pt-4">
                <Button onClick={handleConfirm} size="lg" className="w-full sm:w-auto">
                    Confirm & Continue
                </Button>
            </div>
        </div>
    );
}
