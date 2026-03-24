import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Code2, Terminal, Globe } from "lucide-react"

export default function ApiDocPage() {
    return (
        <div className="container py-10 px-8">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400">
                    <Code2 className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">API Reference</h1>
                    <p className="text-muted-foreground mt-2">Integration guides and endpoint documentation for the Validation Studio.</p>
                </div>
            </div>

            <div className="grid gap-8">
                <section>
                    <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                        <Terminal className="w-5 h-5" />
                        Authentication
                    </h2>
                    <Card className="bg-zinc-950 text-zinc-300 font-mono text-sm border-zinc-800">
                        <CardContent className="pt-6">
                            Authorization: Bearer YOUR_API_KEY
                        </CardContent>
                    </Card>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                        <Globe className="w-5 h-5" />
                        Endpoints
                    </h2>
                    <div className="space-y-4">
                        {[
                            { method: "POST", path: "/api/validate", desc: "Trigger a new validation run" },
                            { method: "GET", path: "/api/status/{runId}", desc: "Check progress of a validation" },
                            { method: "GET", path: "/api/results/{runId}/download", desc: "Export results as JSON/PDF" },
                        ].map((endpoint) => (
                            <Card key={endpoint.path} className="border-border/40 overflow-hidden">
                                <div className="flex items-center gap-4 p-4">
                                    <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-bold rounded">
                                        {endpoint.method}
                                    </span>
                                    <code className="text-sm font-semibold">{endpoint.path}</code>
                                    <span className="ml-auto text-sm text-muted-foreground">{endpoint.desc}</span>
                                </div>
                            </Card>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    )
}
