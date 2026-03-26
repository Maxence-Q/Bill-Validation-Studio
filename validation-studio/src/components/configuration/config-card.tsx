"use client"

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Edit, Trash2, Thermometer, Box, BookOpen } from "lucide-react"
import { Configuration, LLM_MODELS } from "@/types/configuration"

interface ConfigCardProps {
    config: Configuration
    onEdit: (config: Configuration) => void
    onDelete: (id: string) => void
}

export function ConfigCard({ config, onEdit, onDelete }: ConfigCardProps) {
    const modelName = LLM_MODELS.find((m) => m.id === config.model)?.name || config.model

    return (
        <Card className="flex flex-col h-full bg-card/50 hover:bg-card/80 transition-colors border-primary/20">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-xl truncate" title={config.name}>
                            {config.name}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                            ID: {config.id.slice(0, 8)}...
                        </CardDescription>
                    </div>
                    {config.model.includes("gpt") && (
                        <Badge variant="secondary" className="text-xs">v2</Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="grid gap-4 flex-1">
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <Box className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{modelName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-muted-foreground" />
                        <span>Temp: {config.temperature.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span>Refs: {config.references}</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 pt-4 border-t border-border/50">
                <Button variant="ghost" size="sm" onClick={() => onEdit(config)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the configuration
                                "{config.name}".
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDelete(config.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardFooter>
        </Card>
    )
}
