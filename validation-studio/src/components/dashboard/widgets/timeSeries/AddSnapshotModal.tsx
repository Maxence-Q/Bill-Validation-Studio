"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RefreshCw, Camera } from "lucide-react"

export interface AddSnapshotModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    defaultCount: number
    onSubmit: (data: { count: number; note: string }) => Promise<void>
}

export function AddSnapshotModal({
    open,
    onOpenChange,
    defaultCount,
    onSubmit,
}: AddSnapshotModalProps) {
    const [countStr, setCountStr] = useState(defaultCount.toString())
    const [note, setNote] = useState("")
    const [submitting, setSubmitting] = useState(false)

    // Reset state when opening
    useEffect(() => {
        if (open) {
            setCountStr(defaultCount.toString())
            setNote("")
            setSubmitting(false)
        }
    }, [open, defaultCount])

    const count = parseInt(countStr, 10)
    const isValid = !isNaN(count) && count >= 1 && count <= 100

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isValid || submitting) return

        setSubmitting(true)
        try {
            await onSubmit({ count, note: note.trim() })
            onOpenChange(false)
        } catch (err) {
            console.error("Failed to submit snapshot:", err)
            // Error handling (toast) is delegated to the parent where the actual request happens
        } finally {
            if (open) {
                setSubmitting(false)
            }
        }
    }

    return (
        <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Camera className="h-5 w-5 text-violet-400" />
                            Add Snapshot
                        </DialogTitle>
                        <DialogDescription>
                            Capture a new data point for this Time Series widget.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-6">
                        <div className="grid gap-3">
                            <Label htmlFor="runsCount" className="text-sm font-medium">
                                Runs to include
                            </Label>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground">Latest</span>
                                <Input
                                    id="runsCount"
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={countStr}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCountStr(e.target.value)}
                                    className="w-24 font-mono"
                                    disabled={submitting}
                                />
                                <span className="text-sm text-muted-foreground">runs</span>
                            </div>
                            {!isValid && countStr !== "" && (
                                <p className="text-xs text-red-500">Please enter a number between 1 and 100.</p>
                            )}
                        </div>

                        <div className="grid gap-3">
                            <Label htmlFor="snapshotNote" className="text-sm font-medium">
                                Note <span className="text-muted-foreground font-normal">(optional)</span>
                            </Label>
                            <Textarea
                                id="snapshotNote"
                                placeholder="What changed since the last snapshot? (e.g. 'Fixed date coercion edge cases')"
                                className="resize-none h-24 text-sm"
                                value={note}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
                                maxLength={1000}
                                disabled={submitting}
                            />
                            <div className="flex justify-end">
                                <span className="text-[10px] text-muted-foreground/50">
                                    {note.length} / 1000
                                </span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!isValid || submitting}
                            className="bg-violet-600 hover:bg-violet-700 text-white gap-2"
                        >
                            {submitting ? (
                                <><RefreshCw className="h-4 w-4 animate-spin" /> Adding...</>
                            ) : (
                                "Create Snapshot"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
