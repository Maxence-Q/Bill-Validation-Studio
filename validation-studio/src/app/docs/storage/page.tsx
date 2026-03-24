import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, FileJson, History, Settings, MessageSquare, Layout } from "lucide-react"

const storageItems = [
    {
        title: "Configurations",
        file: "configurations.json",
        icon: Settings,
        color: "text-blue-500",
        description: "Stores validation presets, LLM parameters, and strategy selection. Persisted on the server for cross-session consistency."
    },
    {
        title: "Validation History",
        file: "validation_history.json",
        icon: History,
        color: "text-green-500",
        description: "Archive of all past validation runs, including logs, token usage, and final reports."
    },
    {
        title: "Evaluation History",
        file: "validation_history.json",
        icon: MessageSquare,
        color: "text-purple-500",
        description: "Records of comparative evaluation runs between different model versions or strategies."
    },
    {
        title: "Search Index Cache",
        file: "events.json",
        icon: Database,
        color: "text-orange-500",
        description: "A pre-fetched index of event metadata used to power the global search bar and quick event selection across the studio."
    },
    {
        title: "Feedback Data",
        file: "validation_feedback.json",
        icon: MessageSquare,
        color: "text-pink-500",
        description: "User ratings and corrections on validation results, used for fine-tuning strategies."
    },
    {
        title: "Widget Layouts",
        file: "widgets/",
        icon: Layout,
        color: "text-yellow-500",
        description: "Dashboard customization data, component visibility, and user interface preferences."
    }
]

export default function StorageDocPage() {
    return (
        <div className="container py-10 max-w-5xl px-8">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <Database className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Storage Documentation</h1>
                    <p className="text-muted-foreground text-lg italic">Documentation for the validation-studio/data folder.</p>
                </div>
            </div>

            <section className="mb-12">
                <Card className="border-none shadow-xl bg-orange-200/5 backdrop-blur-sm border border-orange-500/10 mb-8 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -translate-y-12 translate-x-12 blur-3xl"></div>
                    <CardHeader>
                        <CardTitle className="text-2xl flex items-center gap-2">
                            <FileJson className="w-5 h-5 text-orange-400" />
                            Data Architecture Overview
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-muted-foreground leading-relaxed">
                            The <code className="bg-accent px-1.5 py-0.5 rounded text-primary">/data</code> folder acts as the local persistent storage layer for the Validation Studio.
                            Most files are stored in <strong>JSON format</strong> for easy accessibility, portability, and readability during debugging.
                            Large history files serve as an append-only log of system activity.
                        </p>
                    </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-6">
                    {storageItems.map((item) => (
                        <Card key={item.title} className="hover:border-primary/50 transition-all border-border/40 group relative overflow-hidden">
                            <div className={`absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity`}>
                                <item.icon className="w-16 h-16" />
                            </div>
                            <CardHeader className="flex flex-row items-center gap-4">
                                <item.icon className={`h-6 w-6 ${item.color}`} />
                                <div>
                                    <CardTitle className="text-lg">{item.title}</CardTitle>
                                    <code className="text-[10px] text-muted-foreground font-mono">{item.file}</code>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground leading-snug">
                                    {item.description}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            <section className="rounded-2xl bg-zinc-950 p-8 border border-zinc-800">
                <h3 className="text-xl font-bold mb-4 text-white">Maintenance & Backups</h3>
                <div className="grid md:grid-cols-2 gap-8 text-sm text-zinc-400">
                    <div className="space-y-2">
                        <h4 className="font-semibold text-zinc-200 uppercase tracking-wider text-[11px]">Large File Handling</h4>
                        <p>History files can grow significant in size. It is recommended to archive files exceeding 50MB to maintain optimal application performance.</p>
                    </div>
                    <div className="space-y-2">
                        <h4 className="font-semibold text-zinc-200 uppercase tracking-wider text-[11px]">Sync Protocol</h4>
                        <p>Configurations and history are stored on the server. The client communicates via documented APIs to retrieve and update the system state, ensuring cross-session consistency.</p>
                    </div>
                </div>
            </section>
        </div>
    )
}
