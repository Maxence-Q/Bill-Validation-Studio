/**
 * RunSelectorDialog Component
 * 
 * Provides a modal interface for users to select specific evaluation runs.
 * Features include searching, bulk selection/deselection, and a detailed list 
 * of available runs with their metadata (event names, IDs, and timestamps).
 */

"use client"

import { useState, useMemo } from "react"
import { DashboardRun } from "@/app/api/dashboard/route"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, CheckCheck, X } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface RunSelectorDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    runs: DashboardRun[]
    selectedIds: Set<string>
    onConfirm: (ids: Set<string>) => void
}

function formatDate(ts: string) {
    return new Date(ts).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export function RunSelectorDialog({
    open,
    onOpenChange,
    runs,
    selectedIds,
    onConfirm,
}: RunSelectorDialogProps) {
    const [localSelected, setLocalSelected] = useState<Set<string>>(new Set(selectedIds))
    const [search, setSearch] = useState("")

    // Reset local state when dialog opens
    const handleOpenChange = (v: boolean) => {
        if (v) setLocalSelected(new Set(selectedIds))
        onOpenChange(v)
    }

    const filtered = useMemo(() => {
        const q = search.toLowerCase()
        if (!q) return runs
        return runs.filter(
            (r) =>
                (r.eventName ?? "").toLowerCase().includes(q) ||
                String(r.eventId).includes(q) ||
                r.id.toLowerCase().includes(q)
        )
    }, [runs, search])

    const toggle = (id: string) => {
        const next = new Set(localSelected)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setLocalSelected(next)
    }

    const selectAll = () => setLocalSelected(new Set(runs.map((r) => r.id)))
    const clearAll = () => setLocalSelected(new Set())

    const handleConfirm = () => {
        onConfirm(localSelected)
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden border border-border/60 bg-card/95 backdrop-blur-xl">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4 border-b border-border/40">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                            Select Evaluation Runs
                            <Badge variant="secondary" className="text-xs font-normal">
                                {localSelected.size === 0 ? "All" : `${localSelected.size} selected`}
                            </Badge>
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Choose which runs to include in the metrics computation.
                        </p>
                    </DialogHeader>

                    {/* Search */}
                    <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, event ID…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9 bg-background/60 border-border/40 focus:border-primary/60"
                        />
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-2 mt-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={selectAll}
                        >
                            <CheckCheck className="h-3.5 w-3.5 mr-1" />
                            Select All
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={clearAll}
                        >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Clear All
                        </Button>
                        <span className="text-xs text-muted-foreground ml-auto">
                            {filtered.length} run{filtered.length !== 1 ? "s" : ""} shown
                        </span>
                    </div>
                </div>

                {/* Table */}
                <ScrollArea className="h-[340px]">
                    <div className="p-2">
                        {/* Column headers */}
                        <div className="grid grid-cols-[40px_1fr_120px_160px] gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/30">
                            <span />
                            <span>Run Name</span>
                            <span className="text-right">Event ID</span>
                            <span className="text-right">Date</span>
                        </div>

                        {filtered.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-8">No runs match your search.</p>
                        )}

                        {filtered.map((run, i) => {
                            const checked = localSelected.has(run.id)
                            return (
                                <div
                                    key={run.id}
                                    onClick={() => toggle(run.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault()
                                            toggle(run.id)
                                        }
                                    }}
                                    className={`w-full grid grid-cols-[40px_1fr_120px_160px] gap-2 items-center px-3 py-2.5 rounded-md transition-colors text-sm cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary ${i % 2 === 0 ? "bg-transparent" : "bg-muted/20"
                                        } ${checked ? "bg-primary/8 hover:bg-primary/12" : "hover:bg-muted/40"}`}
                                >
                                    <Checkbox
                                        checked={checked}
                                        onCheckedChange={() => toggle(run.id)}
                                        className="pointer-events-none"
                                    />
                                    <span className="truncate text-left font-medium" title={run.eventName}>
                                        {run.eventName || <span className="text-muted-foreground italic">Unnamed</span>}
                                    </span>
                                    <span className="text-right font-mono text-muted-foreground text-xs">
                                        {run.eventId}
                                    </span>
                                    <span className="text-right text-muted-foreground text-xs">
                                        {formatDate(run.timestamp)}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <DialogFooter className="px-6 py-4 border-t border-border/40 bg-muted/20">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} className="min-w-[120px]">
                        Apply Selection
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
