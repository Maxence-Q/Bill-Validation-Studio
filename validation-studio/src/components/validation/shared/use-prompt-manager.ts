import { useState, useEffect, useMemo } from "react"
import { ValidationRecord } from "@/lib/configuration/storage-core"

export function usePromptManager(
    record: ValidationRecord | null,
    initialModule: string = "Event"
) {
    const [activeModule, setActiveModule] = useState<string>(initialModule)
    const [promptIndex, setPromptIndex] = useState(0)
    const [reconstructedPrompts, setReconstructedPrompts] = useState<Record<string, any[]> | null>(null)
    const [isReconstructing, setIsReconstructing] = useState(false)

    // Reset state when record changes
    useEffect(() => {
        if (record) {
            setActiveModule(initialModule)
            setPromptIndex(0)
            setReconstructedPrompts(null)

            // Reconstruct if prompts are missing but can be reconstructed
            if ((!record.prompts || Object.keys(record.prompts).length === 0) && record.targetEventId && record.referenceIds) {
                reconstructPromptsForRecord(record)
            }
        }
    }, [record, initialModule])

    // Reset prompt index when module changes
    useEffect(() => {
        setPromptIndex(0)
    }, [activeModule])

    const reconstructPromptsForRecord = async (rec: ValidationRecord) => {
        setIsReconstructing(true)
        try {
            const res = await fetch('/api/validation/reconstruct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetEventId: rec.targetEventId,
                    referenceIds: rec.referenceIds,
                    config: rec.config,
                    perturbationConfig: rec.perturbationConfig
                })
            })
            if (res.ok) {
                const data = await res.json()
                setReconstructedPrompts(data.prompts)
            } else {
                console.error("Failed to reconstruct prompts")
            }
        } catch (e) {
            console.error("Error reconstructing prompts", e)
        } finally {
            setIsReconstructing(false)
        }
    }

    /**
     * Normalizes prompts from any stored format into a consistent array of { content, parentIndex }.
     * Handles: new format, legacy strings, legacy BuiltPrompt[], etc.
     */
    const getNormalizedPrompts = (): { content: string; parentIndex: number }[] => {
        if (!record) return []

        let modulePrompts = record.prompts?.[activeModule]

        // If not in record, check reconstructed
        if (!modulePrompts && reconstructedPrompts) {
            modulePrompts = reconstructedPrompts[activeModule]
        }

        if (!modulePrompts) return []

        // Wrap non-array in array
        const arr = Array.isArray(modulePrompts) ? modulePrompts : [modulePrompts]
        if (arr.length === 0) return []

        // Detect format and normalize
        return arr.map((item: any, idx: number) => {
            // New format: { content, parentIndex }
            if (typeof item === 'object' && item !== null && 'content' in item && 'parentIndex' in item) {
                return { content: item.content as string, parentIndex: item.parentIndex as number }
            }
            // Legacy BuiltPrompt with slicingMetadata — group by parentIndex on the fly
            if (typeof item === 'object' && item !== null && 'slicingMetadata' in item) {
                const content = item.content || item.rendered || JSON.stringify(item, null, 2)
                return { content, parentIndex: item.slicingMetadata.parentIndex as number }
            }
            // Plain string
            if (typeof item === 'string') {
                return { content: item, parentIndex: idx }
            }
            // Object with just .content
            if (typeof item === 'object' && item !== null && 'content' in item) {
                return { content: item.content as string, parentIndex: idx }
            }
            // Fallback: JSON stringify generic objects
            return { content: JSON.stringify(item, null, 2), parentIndex: idx }
        })
    }

    /**
     * Groups normalized prompts by their `parentIndex` so sub-prompts form a single unit.
     */
    const getGroupedPrompts = (): { content: string; parentIndex: number }[] => {
        const normalized = getNormalizedPrompts()
        if (normalized.length === 0) return []

        // Group by parentIndex (handles legacy sub-prompt arrays)
        const grouped = new Map<number, string[]>()
        normalized.forEach(p => {
            const arr = grouped.get(p.parentIndex) || []
            arr.push(p.content)
            grouped.set(p.parentIndex, arr)
        })

        return Array.from(grouped.entries())
            .sort(([a], [b]) => a - b)
            .map(([parentIndex, contents]) => {
                // If any content looks like a full rendered prompt (legacy), join them via divider
                if (contents.some(c => typeof c === 'string' && c.includes("GLOBAL INSTRUCTIONS:"))) {
                    return {
                        content: contents.join("\n\n" + "=".repeat(50) + "\n\n"),
                        parentIndex
                    }
                }

                // Otherwise, join the table data but deduplicate headers
                const combined = contents.map((c, i) => {
                    if (i === 0) return c
                    const lines = c.split("\n")
                    // Skip header and separator (first two lines)
                    return lines.slice(2).join("\n")
                }).filter(s => s.length > 0).join("\n")

                return {
                    content: combined,
                    parentIndex
                }
            })
    }

    // Memoize the grouped prompts for efficiency
    const groupedPrompts = useMemo(() => getGroupedPrompts(), [record, activeModule, reconstructedPrompts])

    const getTotalPromptsCount = () => groupedPrompts.length

    return {
        activeModule,
        setActiveModule,
        promptIndex,
        setPromptIndex,
        isReconstructing,
        groupedPrompts,
        getTotalPromptsCount,
        reconstructedPrompts
    }
}
