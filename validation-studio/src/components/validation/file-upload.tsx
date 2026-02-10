"use client"

import { useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileJson } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileUploadProps {
    onFileUpload: (data: any) => void
}

export function FileUpload({ onFileUpload }: FileUploadProps) {
    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            const file = acceptedFiles[0]
            if (file) {
                const reader = new FileReader()
                reader.onload = () => {
                    try {
                        const json = JSON.parse(reader.result as string)
                        onFileUpload(json)
                    } catch (error) {
                        console.error("Invalid JSON file")
                        alert("The uploaded file is not a valid JSON.")
                    }
                }
                reader.readAsText(file)
            }
        },
        [onFileUpload]
    )

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "application/json": [".json"],
        },
        maxFiles: 1,
    })

    return (
        <div
            {...getRootProps()}
            className={cn(
                "flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ease-in-out bg-card hover:bg-muted/50",
                isDragActive
                    ? "border-primary bg-primary/5 scale-[1.02]"
                    : "border-muted-foreground/25 hover:border-primary/50"
            )}
        >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-full bg-primary/10">
                    {isDragActive ? (
                        <Upload className="h-10 w-10 text-primary animate-bounce" />
                    ) : (
                        <FileJson className="h-10 w-10 text-muted-foreground" />
                    )}
                </div>
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold">
                        {isDragActive ? "Drop the JSON here" : "Upload Event JSON"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Drag and drop your JSON file here, or click to select
                    </p>
                </div>
            </div>
        </div>
    )
}
