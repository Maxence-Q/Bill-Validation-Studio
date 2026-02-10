"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HyperparametersView } from "@/components/configuration/hyperparameters-view"
import { ToolsModifierView } from "@/components/configuration/tools-modifier-view"

export default function ConfigurationPage() {
    return (
        <main className="container py-8 max-w-5xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
                <p className="text-muted-foreground mt-2">
                    Customize your validation environment.
                </p>
            </div>

            <Tabs defaultValue="hyperparameters" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="hyperparameters">Hyperparameters</TabsTrigger>
                    <TabsTrigger value="tools">Tools Modifier</TabsTrigger>
                </TabsList>

                <TabsContent value="hyperparameters" className="space-y-4">
                    <HyperparametersView />
                </TabsContent>

                <TabsContent value="tools" className="space-y-4">
                    <ToolsModifierView />
                </TabsContent>
            </Tabs>
        </main>
    )
}
