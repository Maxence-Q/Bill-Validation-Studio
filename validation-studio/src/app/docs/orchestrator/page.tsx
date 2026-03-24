import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Cpu, Workflow, Layers, ShieldCheck } from "lucide-react"

export default function OrchestratorDocPage() {
    return (
        <div className="container py-10 max-w-5xl px-8">
            <div className="flex items-center gap-4 mb-10">
                <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500">
                    <Cpu className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">Orchestrator Architecture</h1>
                    <p className="text-muted-foreground mt-2">The core engine responsible for data flow and validation logic.</p>
                </div>
            </div>

            <div className="grid gap-10">
                <div className="grid md:grid-cols-3 gap-6 text-center">
                    <Card className="border-none bg-accent/30 py-6">
                        <CardContent className="pt-0 flex flex-col items-center gap-3">
                            <Layers className="w-8 h-8 text-primary" />
                            <h3 className="font-bold">Layered Strategy</h3>
                            <p className="text-xs text-muted-foreground">Multi-stage evaluation from simple checks to complex LLM reasoning.</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none bg-accent/30 py-6">
                        <CardContent className="pt-0 flex flex-col items-center gap-3">
                            <Workflow className="w-8 h-8 text-primary" />
                            <h3 className="font-bold">Pipeline Flow</h3>
                            <p className="text-xs text-muted-foreground">Asynchronous processing with real-time feedback and state caching.</p>
                        </CardContent>
                    </Card>
                    <Card className="border-none bg-accent/30 py-6">
                        <CardContent className="pt-0 flex flex-col items-center gap-3">
                            <ShieldCheck className="w-8 h-8 text-primary" />
                            <h3 className="font-bold">Error Resilience</h3>
                            <p className="text-xs text-muted-foreground">Graceful degradation and automatic retry mechanisms for API failures.</p>
                        </CardContent>
                    </Card>
                </div>

                <section className="space-y-6">
                    <h2 className="text-2xl font-bold">The Validation Loop</h2>
                    <div className="relative border-l-2 border-primary/20 pl-8 space-y-12 py-4">
                        {[
                            { step: "Data Ingestion", desc: "Retrieval of event details and mapping to internal schemas." },
                            { step: "Context Assembly", desc: "Augmenting request with relevant vector search results from Qdrant." },
                            { step: "Prompt Construction", desc: "Transformation of raw data into structured prompts using modular strategies (Chunking, Slicing, Line-by-Line)." },
                            { step: "Agent Inference", desc: "LLM-driven analysis of data consistency and policy adherence." },
                            { step: "Result Synthesis", desc: "Consolidating multiple agent outputs into a unified validation report." },
                        ].map((item, i) => (
                            <div key={i} className="relative">
                                <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-background" />
                                <h4 className="font-bold text-lg">{item.step}</h4>
                                <p className="text-muted-foreground max-w-2xl">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    )
}
