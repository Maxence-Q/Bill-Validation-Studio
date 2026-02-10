"use client"

import { X, FileJson, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

interface EventPreviewProps {
    data: any
    onRemove: () => void
}

export function EventPreview({ data, onRemove }: EventPreviewProps) {
    return (
        <Card className="relative overflow-hidden border-primary/20 bg-background/50 backdrop-blur-sm">
            <div className="absolute top-0 right-0 p-4 z-10">
                <Button variant="ghost" size="icon" onClick={onRemove} className="hover:bg-destructive/10 hover:text-destructive">
                    <X className="h-5 w-5" />
                </Button>
            </div>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <FileJson className="h-5 w-5 text-primary" />
                    Event Loaded
                </CardTitle>
                <CardDescription>
                    Ready for validation. Review the content below.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border bg-muted/50 p-4 font-mono text-xs">
                    <ScrollArea className="h-[300px] w-full">
                        <pre>{JSON.stringify(data, null, 2)}</pre>
                    </ScrollArea>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm text-green-500 font-medium bg-green-500/10 p-2 rounded w-fit">
                    <CheckCircle2 className="h-4 w-4" />
                    Valid JSON Format
                </div>
            </CardContent>
        </Card>
    )
}
