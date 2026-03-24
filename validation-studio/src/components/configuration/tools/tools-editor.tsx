"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Save } from "lucide-react"
import Editor from "@monaco-editor/react"
import { toast } from "sonner"

export function ToolsEditor() {
    const [content, setContent] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        const fetchContent = async () => {
            setIsLoading(true)
            try {
                const res = await fetch(`/api/tools/definitions?lang=en`)
                if (!res.ok) throw new Error("Failed to fetch tools definitions")
                const data = await res.json()
                setContent(data.content || "{}")
            } catch (error) {
                console.error(error)
                toast.error("Failed to load tools definitions.")
            } finally {
                setIsLoading(false)
            }
        }
        fetchContent()
    }, [])

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const res = await fetch("/api/tools/definitions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lang: "en", content }),
            })
            if (!res.ok) throw new Error("Failed to save tools definitions")

            toast.success("Tools definitions saved successfully.")
        } catch (error) {
            console.error(error)
            toast.error("Failed to save tools definitions.")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium">Tools Definitions</h3>
                    <p className="text-sm text-muted-foreground">
                        Define the tools available to the LLM (JSON).
                    </p>
                </div>
                <Button onClick={handleSave} disabled={isSaving || isLoading}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </div>

            <div className="flex-1 mt-4 border rounded-md overflow-hidden min-h-[500px] relative">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : null}
                <Editor
                    height="100%"
                    defaultLanguage="json"
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
        </div>
    )
}
