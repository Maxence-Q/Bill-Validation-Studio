"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, Loader2, Play } from "lucide-react"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function QdrantDocPage() {
    const [eventId, setEventId] = useState("")
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<any[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleTest = async () => {
        if (!eventId) return
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/tools/qdrant-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Execution failed")
            setResults(data.results)
        } catch (e: any) {
            setError(e.message)
            setResults(null)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container py-10 px-8">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <Database className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">Qdrant Documentation</h1>
                    <p className="text-muted-foreground mt-2">Vector database configuration and management for semantic search.</p>
                </div>
            </div>

            <div className="grid gap-6">
                <Card className="border-none shadow-lg bg-secondary/20">
                    <CardHeader>
                        <CardTitle>Overview</CardTitle>
                        <CardDescription>How we use Qdrant for semantic validation</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            Qdrant serves as our primary vector store for performing semantic similarity checks during validation.
                            It allows us to compare event data against reference datasets with high precision using dense embeddings.
                        </p>
                    </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-6">
                    <Card className="border-border/40">
                        <CardHeader>
                            <CardTitle className="text-lg">Collections</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                                <li>Events Collection: Stores historical validated events</li>
                                <li>Reference Collection: Base knowledge for cross-referencing</li>
                                <li>Temporary Buffers: High-speed ingestion for active runs</li>
                            </ul>
                        </CardContent>
                    </Card>
                    <Card className="border-border/40">
                        <CardHeader>
                            <CardTitle className="text-lg">Search Parameters</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                                <li>Distance Metric: Cosine Similarity</li>
                                <li>HNSW Config: Optimized for low-latency retrieval</li>
                                <li>Filtering: Payload-based dynamic filtering</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Play className="w-4 h-4" />
                            Try it: Context Retrieval
                        </CardTitle>
                        <CardDescription>
                            Enter a Target Event ID to see which references Qdrant recommends.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-3">
                            <Input
                                placeholder="Event ID (e.g. 6723)"
                                value={eventId}
                                onChange={(e) => setEventId(e.target.value)}
                                className="max-w-[200px]"
                                type="number"
                            />
                            <Button onClick={handleTest} disabled={loading || !eventId}>
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                                Run Retrieval
                            </Button>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
                                {error}
                            </div>
                        )}

                        {results && (
                            <div className="bg-background/50 rounded-lg border overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium">Rank</th>
                                            <th className="px-4 py-2 text-left font-medium">Event ID</th>
                                            <th className="px-4 py-2 text-left font-medium">Score</th>
                                            <th className="px-4 py-2 text-left font-medium">Name</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {results.map((r, i) => (
                                            <tr key={r.id}>
                                                <td className="px-4 py-2 text-muted-foreground font-mono">#{i + 1}</td>
                                                <td className="px-4 py-2 font-semibold">{r.id}</td>
                                                <td className="px-4 py-2">
                                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-mono">
                                                        {r.score.toFixed(6)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 italic text-muted-foreground max-w-[200px] truncate">
                                                    {r.payload?.Event?.Event?.NameFr || r.payload?.Event?.Event?.NameEN || "-"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
