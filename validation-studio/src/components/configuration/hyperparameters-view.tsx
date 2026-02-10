"use client"

import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ConfigCard } from "@/components/configuration/config-card"
import { ConfigForm } from "@/components/configuration/config-form"
import { Configuration } from "@/types/configuration"
import { CookieManager } from "@/lib/cookie-manager"

export function HyperparametersView() {
    const [configs, setConfigs] = useState<Configuration[]>([])
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingConfig, setEditingConfig] = useState<Configuration | null>(null)
    const [isClient, setIsClient] = useState(false)

    // Load configs from cookies on mount
    useEffect(() => {
        setIsClient(true)
        const savedConfigs = CookieManager.get("llm_configurations")
        if (savedConfigs) {
            try {
                setConfigs(JSON.parse(savedConfigs))
            } catch (e) {
                console.error("Failed to parse configurations", e)
            }
        }
    }, [])

    // Save configs to cookies whenever they change
    useEffect(() => {
        if (isClient) {
            CookieManager.set("llm_configurations", JSON.stringify(configs), { expires: 365 })
        }
    }, [configs, isClient])

    const handleCreateOrUpdate = (config: Configuration) => {
        if (editingConfig) {
            setConfigs(configs.map((c) => (c.id === config.id ? config : c)))
        } else {
            setConfigs([...configs, config])
        }
        setIsDialogOpen(false)
        setEditingConfig(null)
    }

    const handleDelete = (id: string) => {
        setConfigs(configs.filter((c) => c.id !== id))
    }

    const openAddDialog = () => {
        setEditingConfig(null)
        setIsDialogOpen(true)
    }

    const openEditDialog = (config: Configuration) => {
        setEditingConfig(config)
        setIsDialogOpen(true)
    }

    if (!isClient) {
        return null // Prevent hydration mismatch
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Hyperparameters</h2>
                    <p className="text-muted-foreground mt-1 max-w-2xl">
                        Manage your LLM hyperparameters and validation settings. Create multiple presets for different testing scenarios.
                    </p>
                </div>
                {configs.length > 0 && (
                    <Button onClick={openAddDialog}>
                        <Plus className="mr-2 h-4 w-4" /> Add Configuration
                    </Button>
                )}
            </div>

            {configs.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed rounded-xl bg-muted/30">
                    <div className="p-4 rounded-full bg-primary/10 mb-4">
                        <Plus className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">No configurations yet</h3>
                    <p className="text-muted-foreground mb-6 text-center max-w-md">
                        Get started by creating your first validation preset. You&apos;ll be able to reuse it across your tests.
                    </p>
                    <Button size="lg" onClick={openAddDialog}>
                        Create your first configuration
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {configs.map((config) => (
                        <ConfigCard
                            key={config.id}
                            config={config}
                            onEdit={openEditDialog}
                            onDelete={handleDelete}
                        />
                    ))}
                    {/* Add New Card (Optional visual cue) */}
                    <div
                        onClick={openAddDialog}
                        className="flex flex-col items-center justify-center h-full min-h-[200px] border-2 border-dashed rounded-xl border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50 transition-all cursor-pointer group"
                    >
                        <Plus className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                        <span className="font-medium text-muted-foreground group-hover:text-primary">Add New</span>
                    </div>
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingConfig ? "Edit Configuration" : "New Configuration"}</DialogTitle>
                        <DialogDescription>
                            Configure the model, temperature, and other validation parameters.
                        </DialogDescription>
                    </DialogHeader>
                    <ConfigForm
                        initialData={editingConfig}
                        onSubmit={handleCreateOrUpdate}
                        onCancel={() => setIsDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}
