"use client"

import { useState, useEffect, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Loader2, Save } from "lucide-react"
import Editor from "@monaco-editor/react"
import { toast } from "sonner"

export function PromptsEditor() {
    const [activeLang, setActiveLang] = useState<"fr" | "en">("fr")
    const [content, setContent] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const fetchContent = useCallback(async (lang: string) => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/tools/prompts?lang=${lang}`)
            if (!res.ok) throw new Error("Failed to fetch prompts")
            const data = await res.json()
            setContent(data.content || "")
        } catch (error) {
            console.error(error)
            toast.error("Failed to load prompts.")
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchContent(activeLang)
    }, [activeLang, fetchContent])

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const res = await fetch("/api/tools/prompts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lang: activeLang, content }),
            })
            if (!res.ok) throw new Error("Failed to save prompts")

            toast.success("Prompts saved successfully.")
        } catch (error) {
            console.error(error)
            toast.error("Failed to save prompts.")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">System & User Prompts</h3>
                    <p className="text-sm text-muted-foreground">
                        Customize the instructions sent to the LLM.
                    </p>
                </div>
                <Button onClick={handleSave} disabled={isSaving || isLoading}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </div>

            <Tabs value={activeLang} onValueChange={(v) => setActiveLang(v as "fr" | "en")} className="flex-1 flex flex-col">
                <TabsList className="grid w-full max-w-[200px] grid-cols-2">
                    <TabsTrigger value="fr">Français</TabsTrigger>
                    <TabsTrigger value="en">English</TabsTrigger>
                </TabsList>

                <div className="flex-1 mt-4 border rounded-md overflow-hidden min-h-[500px] relative">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : null}
                    <Editor
                        height="100%"
                        defaultLanguage="markdown"
                        theme="vs-dark"
                        value={content}
                        onChange={(value) => setContent(value || "")}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            wordWrap: "on",
                            scrollBeyondLastLine: false,
                        }}
                    />
                </div>
            </Tabs>
        </div>
    )
}
