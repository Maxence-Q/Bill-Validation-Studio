import { ValidationRecord } from "@/lib/configuration/storage-core"

export interface EvaluationDetailsDialogProps {
    record: ValidationRecord | null
    isOpen: boolean
    onClose: () => void
    template: string
}

export type ViewMode = 'regular' | 'advanced'
export type PerturbationFilter = 'all' | 'found' | 'not-found'
export type ClassificationFilter = 'all' | 'TP' | 'FP'

export interface EvaluationDialogLogic {
    activeModule: string
    setActiveModule: (module: string) => void
    promptIndex: number
    setPromptIndex: (index: number) => void
    isReconstructing: boolean
    groupedPrompts: any[]
    totalPrompts: number
    viewMode: ViewMode
    setViewMode: (mode: ViewMode) => void
    highlightedLine: number | null
    setHighlightedLine: (line: number | null) => void
    highlightedIssuePath: string | null
    setHighlightedIssuePath: (path: string | null) => void
    perturbationFilter: PerturbationFilter
    setPerturbationFilter: (filter: PerturbationFilter) => void
    classificationFilter: ClassificationFilter
    setClassificationFilter: (filter: ClassificationFilter) => void
    scrollToPerturbation: string | null
    setScrollToPerturbation: (path: string | null) => void
    getFilteredIssues: () => any[]
    getCurrentPrompt: () => string
    getCurrentReasoning: () => string
    getCurrentPerturbations: () => any[]
    findLineForPath: (path: string, promptText: string) => number | null
}
