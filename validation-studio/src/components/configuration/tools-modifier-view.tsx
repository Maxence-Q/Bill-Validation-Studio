"use client"

import { useState } from "react"
import { MessageSquare, Building2, FileText, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PromptsEditor } from "./tools/prompts-editor"
import { OrganisationsEditor } from "./tools/organisations-editor"
import { DataDescriptionEditor } from "./tools/data-description-editor"
import { ToolsEditor } from "./tools/tools-editor"

type ToolView = "prompts" | "organisations" | "data" | "tools"

export function ToolsModifierView() {
    const [activeView, setActiveView] = useState<ToolView>("prompts")

    return (
        <div className="flex flex-col md:flex-row gap-8 h-full min-h-[500px]">
            {/* Sidebar Navigation */}
            <aside className="w-full md:w-[240px] flex-shrink-0">
                <nav className="flex flex-col space-y-2">
                    <NavButton
                        active={activeView === "prompts"}
                        onClick={() => setActiveView("prompts")}
                        icon={<MessageSquare className="h-4 w-4 mr-2" />}
                    >
                        Prompts
                    </NavButton>
                    <NavButton
                        active={activeView === "tools"}
                        onClick={() => setActiveView("tools")}
                        icon={<Wrench className="h-4 w-4 mr-2" />}
                    >
                        Tools
                    </NavButton>
                    <NavButton
                        active={activeView === "organisations"}
                        onClick={() => setActiveView("organisations")}
                        icon={<Building2 className="h-4 w-4 mr-2" />}
                    >
                        Organisations
                    </NavButton>
                    <NavButton
                        active={activeView === "data"}
                        onClick={() => setActiveView("data")}
                        icon={<FileText className="h-4 w-4 mr-2" />}
                    >
                        Data Description
                    </NavButton>
                </nav>
            </aside>

            {/* Content Area */}
            <div className="flex-1">
                {activeView === "prompts" && <PromptsEditor />}
                {activeView === "tools" && <ToolsEditor />}
                {activeView === "organisations" && <OrganisationsEditor />}
                {activeView === "data" && <DataDescriptionEditor />}
            </div>
        </div>
    )
}

interface NavButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    active: boolean
    icon: React.ReactNode
}

function NavButton({ active, icon, children, className, ...props }: NavButtonProps) {
    return (
        <Button
            variant={active ? "secondary" : "ghost"}
            className={cn("w-full justify-start", active && "bg-muted", className)}
            {...props}
        >
            {icon}
            {children}
        </Button>
    )
}
