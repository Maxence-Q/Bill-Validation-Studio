"use client"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { Plus } from "lucide-react"
import { EvaluationHistoryTable } from "@/components/evaluation/evaluation-history-table"
import { EvaluationDetailsDialog } from "@/components/evaluation/evaluation-details-dialog"
import { CreateEvaluationDialog } from "@/components/evaluation/create-evaluation-dialog"

export default function EvaluationPage() {
    const [history, setHistory] = useState<ValidationRecord[]>([])
    const [observabilityHistory, setObservabilityHistory] = useState<ValidationRecord[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedRecord, setSelectedRecord] = useState<ValidationRecord | null>(null)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [evalRes, obsRes] = await Promise.all([
                fetch("/api/evaluation"),
                fetch("/api/observability")
            ])

            if (evalRes.ok) {
                const data = await evalRes.json()
                setHistory(data)
            }
            if (obsRes.ok) {
                const data = await obsRes.json()
                setObservabilityHistory(data)
            }
        } catch (error) {
            console.error("Failed to fetch history:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const deleteRecord = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this evaluation record?")) return;

        try {
            const res = await fetch(`/api/evaluation?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                setHistory(prev => prev.filter(r => r.id !== id));
            } else {
                console.error("Failed to delete record");
            }
        } catch (error) {
            console.error("Error deleting record:", error);
        }
    }

    return (
        <main className="container py-8 max-w-[1600px]">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">Evaluation</h1>
                    <p className="text-xl text-muted-foreground">
                        Test event validation scenarios.
                    </p>
                </div>
                <Button onClick={() => setIsModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Create New Evaluation
                </Button>
            </div>

            <div className="grid gap-6">
                <EvaluationHistoryTable
                    history={history}
                    isLoading={isLoading}
                    onSelectRecord={setSelectedRecord}
                    onDeleteRecord={deleteRecord}
                />
            </div>

            <EvaluationDetailsDialog
                record={selectedRecord}
                isOpen={!!selectedRecord}
                onClose={() => setSelectedRecord(null)}
            />

            <CreateEvaluationDialog
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false)
                    fetchData()
                }}
                observabilityHistory={observabilityHistory}
            />
        </main>
    );
}
