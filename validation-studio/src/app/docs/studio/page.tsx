import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LayoutDashboard, Settings, Eye, BarChart3, Microscope, Layout } from "lucide-react"

const studioTabs = [
    {
        title: "Validation Studio",
        icon: Microscope,
        color: "text-blue-500",
        description: "L'espace de travail principal. C'est ici que vous lancez les validations individuelles, visualisez les résultats en temps réel et analysez les raisonnements de l'IA (LLM).",
        usage: "Sélectionnez un événement, choisissez une configuration et lancez le 'Run'. Consultez le rapport de validation une fois terminé."
    },
    {
        title: "Configuration",
        icon: Settings,
        color: "text-orange-500",
        description: "Le centre de contrôle des paramètres. Permet de définir les modèles LLM, la température, les stratégies de chunking et le nombre de références RAG.",
        usage: "Créez ou modifiez des presets pour tester différentes approches de validation sans changer le code."
    },
    {
        title: "Observability",
        icon: Eye,
        color: "text-green-500",
        description: "Historique complet des validations passées. Permet de revoir chaque exécution, les logs détaillés et les métriques de performance.",
        usage: "Filtrez par date ou par ID d'événement pour auditer la qualité des validations historiques."
    },
    {
        title: "Evaluation",
        icon: BarChart3,
        color: "text-purple-500",
        description: "Tests de masse et comparaison de stratégies. Permet de lancer des validations sur des sets d'événements pour calculer Precision et Recall.",
        usage: "Utilisé pour valider une nouvelle version du prompt ou une nouvelle stratégie de slicing avant mise en production."
    },
    {
        title: "Dashboard",
        icon: LayoutDashboard,
        color: "text-pink-500",
        description: "Vue d'ensemble analytique. Visualisation des tendances de qualité et des erreurs les plus fréquentes via des widgets personnalisables.",
        usage: "Suivez l'évolution de la fiabilité du système au fil du temps."
    }
]

export default function StudioDocPage() {
    return (
        <div className="container py-10 max-w-5xl px-8">
            <div className="flex items-center gap-4 mb-10">
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <Layout className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">Le Studio</h1>
                    <p className="text-muted-foreground mt-2">Guide d'utilisation des différentes sections de l'application.</p>
                </div>
            </div>

            <div className="grid gap-8">
                {studioTabs.map((tab) => (
                    <Card key={tab.title} className="border-border/40 overflow-hidden group">
                        <div className="flex flex-col md:flex-row">
                            <div className="p-6 md:w-1/3 bg-secondary/10 flex flex-col items-center justify-center text-center gap-3 border-b md:border-b-0 md:border-r border-border/40">
                                <tab.icon className={`w-12 h-12 ${tab.color} group-hover:scale-110 transition-transform`} />
                                <h3 className="text-xl font-bold">{tab.title}</h3>
                            </div>
                            <div className="p-6 md:w-2/3 space-y-4">
                                <div>
                                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">Utilité</h4>
                                    <p className="text-sm leading-relaxed text-foreground/90">{tab.description}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">Utilisation</h4>
                                    <p className="text-sm italic text-muted-foreground">{tab.usage}</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    )
}
