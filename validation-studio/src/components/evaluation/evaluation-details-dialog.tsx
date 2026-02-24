"use client"

import { useEvaluationDialogLogic } from "./details/use-evaluation-dialog-logic"
import { EvaluationDetailsDialogProps } from "./details/types"
import { TopBar } from "./details/components/top-bar"
import { IssuesPanel, PerturbationsPanel } from "./details/components/panels"
import { AdvancedView, RegularView } from "./details/components/views"

export function EvaluationDetailsDialog({
    record,
    isOpen,
    onClose,
    template
}: EvaluationDetailsDialogProps) {
    const logic = useEvaluationDialogLogic(record!, template)

    if (!record) return null

    const {
        activeModule,
        setActiveModule,
        setHighlightedLine,
        setHighlightedReasoningLine,
        setHighlightedIssuePath,
        classificationFilter,
        setClassificationFilter,
        highlightedIssuePath,
        getCurrentPrompt,
        getCurrentReasoning,
        findLineForPath,
        setScrollToPerturbation,
        getFilteredIssues,
        perturbationFilter,
        setPerturbationFilter,
        getCurrentPerturbations,
        viewMode
    } = logic

    const handleModuleChange = () => {
        setHighlightedLine(null)
        setHighlightedReasoningLine(null)
        setHighlightedIssuePath(null)
    }

    const handleIssueClick = (issue: any) => {
        const path = issue.path || ""
        if (!path) return
        const promptText = getCurrentPrompt()
        const line = findLineForPath(path, promptText)
        if (line !== null) setHighlightedLine(line)

        const reasoningText = getCurrentReasoning()
        const reasoningLine = findLineForPath(path, reasoningText)
        setHighlightedReasoningLine(reasoningLine !== null ? reasoningLine : null)

        setHighlightedIssuePath(path)
        if (issue.classification === 'TP') {
            setScrollToPerturbation(path.trim())
        }
    }

    const handlePerturbationClick = (path: string, isDetected: boolean) => {
        const promptText = getCurrentPrompt()
        const line = findLineForPath(path, promptText)
        if (line !== null) setHighlightedLine(line)

        const reasoningText = getCurrentReasoning()
        const reasoningLine = findLineForPath(path, reasoningText)
        setHighlightedReasoningLine(reasoningLine !== null ? reasoningLine : null)

        setHighlightedIssuePath(isDetected ? path : null)
    }

    const topBar = (
        <TopBar
            record={record}
            activeModule={activeModule}
            setActiveModule={setActiveModule}
            onModuleChange={handleModuleChange}
        />
    )

    const issuesPanel = (
        <IssuesPanel
            issues={getFilteredIssues()}
            classificationFilter={classificationFilter}
            setClassificationFilter={setClassificationFilter}
            highlightedIssuePath={highlightedIssuePath}
            onIssueClick={handleIssueClick}
        />
    )

    if (viewMode === 'advanced') {
        return (
            <AdvancedView
                isOpen={isOpen}
                onClose={onClose}
                record={record}
                logic={logic}
                TopBar={topBar}
                IssuesPanel={issuesPanel}
            />
        )
    }

    return (
        <RegularView
            isOpen={isOpen}
            onClose={onClose}
            record={record}
            logic={logic}
            TopBar={topBar}
            RightContent={
                <div className="flex h-full min-w-0">
                    <div className="w-1/2 flex flex-col border-r h-full">
                        <PerturbationsPanel
                            perturbations={getCurrentPerturbations()}
                            perturbationFilter={perturbationFilter}
                            setPerturbationFilter={setPerturbationFilter}
                            issues={record.issues}
                            onPerturbationClick={handlePerturbationClick}
                        />
                    </div>
                    <div className="w-1/2 flex flex-col h-full">
                        {issuesPanel}
                    </div>
                </div>
            }
        />
    )
}
