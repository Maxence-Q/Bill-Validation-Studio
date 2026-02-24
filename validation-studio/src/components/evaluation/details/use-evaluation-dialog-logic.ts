import { useState, useEffect } from "react"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { renderPrompt } from "@/lib/validation/prompt-builder"
import { usePromptManager } from "@/components/validation/shared/use-prompt-manager"
import { ClassificationFilter, EvaluationDialogLogic, PerturbationFilter, ViewMode } from "./types"

export function useEvaluationDialogLogic(
    record: ValidationRecord,
    template: string
): EvaluationDialogLogic {
    const {
        activeModule,
        setActiveModule,
        promptIndex,
        setPromptIndex,
        isReconstructing,
        groupedPrompts,
        getTotalPromptsCount
    } = usePromptManager(record)

    const [highlightedLine, setHighlightedLine] = useState<number | null>(null)
    const [highlightedReasoningLine, setHighlightedReasoningLine] = useState<number | null>(null)
    const [highlightedIssuePath, setHighlightedIssuePath] = useState<string | null>(null)
    const [scrollToPerturbation, setScrollToPerturbation] = useState<string | null>(null)
    const [perturbationFilter, setPerturbationFilter] = useState<PerturbationFilter>('all')
    const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>('all')
    const [viewMode, setViewMode] = useState<ViewMode>('regular')

    useEffect(() => {
        if (scrollToPerturbation !== null) {
            const timeoutId = setTimeout(() => {
                const element = document.getElementById(`perturbation-${scrollToPerturbation}`)
                if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "center" })
                    setScrollToPerturbation(null)
                }
            }, 100)
            return () => clearTimeout(timeoutId)
        }
    }, [scrollToPerturbation])

    const getFilteredIssues = () => {
        return record.issues.filter((issue: any) =>
            (issue.module === activeModule) &&
            (issue.itemIndex === undefined || issue.itemIndex === promptIndex) &&
            (classificationFilter === 'all' || issue.classification === classificationFilter)
        )
    }

    const getCurrentPerturbations = () => {
        const tracking = record.perturbationTracking || (record as any).perturbations
        if (!tracking) return []
        const moduleTrack = tracking[activeModule]
        if (!moduleTrack) return []

        if (Array.isArray(moduleTrack)) {
            const wrapper = moduleTrack.find((p: any) => p.index === promptIndex)
            if (wrapper && Array.isArray(wrapper.details)) {
                return wrapper.details
            }
            if (moduleTrack.length > 0 && 'details' in moduleTrack[0]) {
                return []
            }
            return moduleTrack
        }
        return []
    }

    const getCurrentPrompt = () => {
        if (isReconstructing) return "Reconstructing prompts..."
        if (groupedPrompts.length === 0) return "No prompt for this module"
        const currentPrompt = groupedPrompts[promptIndex]
        if (!currentPrompt) return "No prompt for this module"

        if (currentPrompt.content.includes("GLOBAL INSTRUCTIONS:")) {
            return currentPrompt.content
        }

        const basePrompt = renderPrompt(currentPrompt.content, template, {
            elementName: `${activeModule} Evaluation - Item ${promptIndex + 1}`,
            targetId: (record.eventId || record.targetEventId || "Unknown").toString(),
            referenceIds: "Evaluation Record",
            strategy: "Perturbation Analysis"
        })

        const perturbations = getCurrentPerturbations()
        if (!perturbations || perturbations.length === 0) return basePrompt

        const lines = basePrompt.split('\n')
        let insideTable = false
        let targetColIndex = -1
        let pathColIndex = -1

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]

            if (line.includes("DATA TO VALIDATE")) {
                continue
            }

            if (line.includes("|") && line.includes("TARGET") && !insideTable) {
                const parts = line.split("|").map(s => s.trim())
                const targetIdx = parts.indexOf("TARGET")
                const pathIdx = parts.indexOf("PATH")
                if (targetIdx !== -1) {
                    insideTable = true
                    targetColIndex = targetIdx
                    pathColIndex = pathIdx
                    continue
                }
            }

            if (insideTable) {
                if (line.trim() === '' || line.startsWith('------')) {
                    insideTable = false
                    continue
                }
                if (line.includes("--- | ---")) continue

                const parts = line.split("|")
                if (parts.length > targetColIndex) {
                    let pathValue = ""
                    if (pathColIndex !== -1 && parts.length > pathColIndex) {
                        pathValue = parts[pathColIndex].trim()
                    }

                    const matchingPerturbation = perturbations.find((p: any) => p.path === pathValue)
                    if (matchingPerturbation) {
                        parts[targetColIndex] = ` ${matchingPerturbation.perturbed} `
                        lines[i] = parts.join("|")
                    }
                }
            }
        }

        return lines.join('\n')
    }

    const getCurrentReasoning = (): string => {
        const moduleReasonings = record.reasonings?.[activeModule]
        if (!moduleReasonings) return ""
        return moduleReasonings[promptIndex] ?? ""
    }

    const findLineForPath = (path: string, promptText: string): number | null => {
        if (!promptText || !path) return null
        const lines = promptText.split('\n')

        const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const escapedPath = escapeRegExp(path)
        const regex = new RegExp(`(^|[^a-zA-Z0-9_.])` + escapedPath + `([^a-zA-Z0-9_]|$)`)

        for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) return i
        }

        const fallbackIndex = lines.findIndex(line => line.includes(path))
        if (fallbackIndex !== -1) return fallbackIndex

        const parts = path.split('.')
        const leaf = parts[parts.length - 1]
        if (leaf && leaf !== path) {
            const escapedLeaf = escapeRegExp(leaf)
            const leafRegex = new RegExp(`(^|[^a-zA-Z0-9_.])` + escapedLeaf + `([^a-zA-Z0-9_]|$)`)
            for (let i = 0; i < lines.length; i++) {
                if (leafRegex.test(lines[i])) return i
            }
            const fallbackLeafIndex = lines.findIndex(line => line.includes(leaf))
            if (fallbackLeafIndex !== -1) return fallbackLeafIndex
        }

        return null
    }

    return {
        activeModule,
        setActiveModule,
        promptIndex,
        setPromptIndex,
        isReconstructing,
        groupedPrompts,
        totalPrompts: getTotalPromptsCount(),
        viewMode,
        setViewMode,
        highlightedLine,
        setHighlightedLine,
        highlightedReasoningLine,
        setHighlightedReasoningLine,
        highlightedIssuePath,
        setHighlightedIssuePath,
        perturbationFilter,
        setPerturbationFilter,
        classificationFilter,
        setClassificationFilter,
        scrollToPerturbation,
        setScrollToPerturbation,
        getFilteredIssues,
        getCurrentPrompt,
        getCurrentReasoning,
        getCurrentPerturbations,
        findLineForPath
    }
}
