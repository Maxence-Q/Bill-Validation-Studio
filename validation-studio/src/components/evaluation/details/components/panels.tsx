import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { IssuesDisplay } from "@/components/validation/issues-display"
import { cn } from "@/lib/utils"
import { CheckCircle2, Filter, XCircle, ArrowRight } from "lucide-react"
import { ClassificationFilter, PerturbationFilter } from "../types"

interface IssuesPanelProps {
    issues: any[]
    classificationFilter: ClassificationFilter
    setClassificationFilter: (filter: ClassificationFilter) => void
    highlightedIssuePath: string | null
    onIssueClick: (issue: any) => void
}

export function IssuesPanel({
    issues,
    classificationFilter,
    setClassificationFilter,
    highlightedIssuePath,
    onIssueClick
}: IssuesPanelProps) {
    return (
        <>
            <div className="p-3 border-b bg-muted/10 font-medium text-sm text-muted-foreground flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <span>Issues Found</span>
                    <div className="flex bg-muted/50 p-0.5 rounded-lg border">
                        {['all', 'TP', 'FP'].map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setClassificationFilter(filter as any)}
                                className={cn(
                                    "px-2 py-0.5 text-[10px] font-bold uppercase rounded-md transition-all",
                                    classificationFilter === filter
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {filter === 'all' ? 'All' : filter}
                            </button>
                        ))}
                    </div>
                </div>
                <span className={cn("text-xs px-2 py-0.5 rounded-full",
                    issues.length > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                )}>
                    {issues.length} issues
                </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                <IssuesDisplay
                    issues={issues}
                    highlightedPath={highlightedIssuePath}
                    onIssueClick={onIssueClick}
                />
            </div>
        </>
    )
}

interface PerturbationsPanelProps {
    perturbations: any[]
    perturbationFilter: PerturbationFilter
    setPerturbationFilter: (filter: PerturbationFilter) => void
    issues: any[]
    onPerturbationClick: (path: string, isDetected: boolean) => void
}

export function PerturbationsPanel({
    perturbations,
    perturbationFilter,
    setPerturbationFilter,
    issues,
    onPerturbationClick
}: PerturbationsPanelProps) {
    const filteredPerturbations = perturbations.filter((p: any) => {
        if (perturbationFilter === 'all') return true
        const isDetected = issues.some((issue: any) => p.path.trim() === (issue.path || "").trim())
        if (perturbationFilter === 'found') return isDetected
        if (perturbationFilter === 'not-found') return !isDetected
        return true
    })

    return (
        <div className="flex flex-col h-full">
            <div className="p-3 border-b bg-muted/10 font-medium text-sm text-muted-foreground flex justify-between items-center">
                <span>Perturbations Applied ({perturbations.length})</span>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                            <Filter className={cn("h-4 w-4", perturbationFilter !== 'all' ? "text-primary fill-primary/20" : "")} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPerturbationFilter('all')}>
                            <div className="flex items-center gap-2">
                                <div className={cn("w-4 h-4 rounded-full border", perturbationFilter === 'all' ? "bg-primary border-primary" : "border-muted-foreground")} />
                                <span>All</span>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPerturbationFilter('found')}>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className={perturbationFilter === 'found' ? "font-semibold" : ""}>Found</span>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPerturbationFilter('not-found')}>
                            <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-gray-500" />
                                <span className={perturbationFilter === 'not-found' ? "font-semibold" : ""}>Not found</span>
                            </div>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-0">
                {filteredPerturbations.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                        <span>No perturbations found.</span>
                        {perturbationFilter !== 'all' && (
                            <Button variant="link" size="sm" onClick={() => setPerturbationFilter('all')}>
                                Clear filter
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="w-full">
                        {filteredPerturbations.map((p: any, idx: number) => {
                            const isDetected = issues.some((issue: any) => p.path.trim() === (issue.path || "").trim())
                            return (
                                <div
                                    key={idx}
                                    id={`perturbation-${p.path.trim()}`}
                                    className="p-4 hover:bg-muted/5 text-sm border-b last:border-0 border-border"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div
                                            className="font-medium text-sm text-foreground bg-primary/10 px-2 py-0.5 rounded break-all mr-2 cursor-pointer hover:bg-primary/20 hover:underline transition-colors block"
                                            onClick={() => onPerturbationClick(p.path, isDetected)}
                                        >
                                            {p.path}
                                        </div>
                                        {isDetected ? (
                                            <span className="shrink-0 inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                                                Found
                                            </span>
                                        ) : (
                                            <span className="shrink-0 inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                                                Not found
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
                                        <div className="bg-muted/30 text-muted-foreground p-2 rounded text-xs font-mono break-all border border-transparent">
                                            {p.original === "" ? <span className="italic opacity-50">&lt;empty&gt;</span> : p.original}
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                                        <div className="bg-background text-foreground p-2 rounded text-xs font-mono break-all border border-border shadow-sm">
                                            {p.perturbed === "" ? <span className="italic opacity-50">&lt;empty&gt;</span> : p.perturbed}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
