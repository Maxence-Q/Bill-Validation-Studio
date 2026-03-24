import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Layers, Zap, Shield, Terminal, Globe, Palette } from "lucide-react"

const stackItems = [
    {
        title: "Main Framework",
        tech: "Next.js 16.1.6 (App Router)",
        icon: Zap,
        color: "text-blue-500",
        description: "Handles routing, server-side rendering, and API interactions. React 19 provides the UI foundation."
    },
    {
        title: "Styling & UI",
        tech: "Tailwind CSS v4 & Radix UI",
        icon: Palette,
        color: "text-pink-500",
        description: "Utility-first CSS paired with headless accessible primitives for a premium, responsive interface."
    },
    {
        title: "Data Validation",
        tech: "Zod & React Hook Form",
        icon: Shield,
        color: "text-green-500",
        description: "Strict schema validation and performant form management for complex configuration inputs."
    },
    {
        title: "Integration Layer",
        tech: "Axios & OpenAI / Qdrant SDKs",
        icon: Globe,
        color: "text-purple-500",
        description: "Handles external communications with LLMs, vector databases, and background processing services."
    },
    {
        title: "Code Editing",
        tech: "Monaco Editor",
        icon: Terminal,
        color: "text-zinc-400",
        description: "Embedded code editor for professional JSON and prompt manipulation directly in the browser."
    },
    {
        title: "Language Layer",
        tech: "TypeScript 5.x",
        icon: Layers,
        color: "text-blue-600",
        description: "End-to-end type safety ensuring stability and developer productivity across the entire codebase."
    }
]

export default function StackDocPage() {
    return (
        <div className="container py-10 max-w-5xl px-8">
            <div className="flex items-center gap-4 mb-10">
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <Layers className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">Technical Stack</h1>
                    <p className="text-muted-foreground mt-2">The architecture and technologies powering the Validation Studio.</p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
                {stackItems.map((item) => (
                    <Card key={item.title} className="border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <item.icon className={`h-8 w-8 ${item.color}`} />
                            <div>
                                <CardTitle>{item.title}</CardTitle>
                                <CardDescription className="text-primary/70 font-medium">{item.tech}</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {item.description}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <section className="space-y-6 bg-accent/20 p-8 rounded-2xl border border-border/40">
                <h2 className="text-2xl font-bold">Key Architectural Principles</h2>
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <h4 className="font-bold text-sm uppercase tracking-wider opacity-60">Streaming First</h4>
                        <p className="text-sm text-muted-foreground">Utilises NDJSON for real-time validation feedback and progress tracking.</p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-bold text-sm uppercase tracking-wider opacity-60">Server-Side Configuration</h4>
                        <p className="text-sm text-muted-foreground">Validation strategies and parameters are managed and persisted on the server for consistency across sessions.</p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-bold text-sm uppercase tracking-wider opacity-60">Modular Components</h4>
                        <p className="text-sm text-muted-foreground">Strict separation between Shadcn/ui core primitives and complex business logic components.</p>
                    </div>
                </div>
            </section>
        </div>
    )
}
