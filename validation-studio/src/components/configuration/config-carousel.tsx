"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight, Cpu, Zap, Beaker, CheckCircle2 } from "lucide-react"
import { Configuration, LLM_MODELS, BUILDER_STRATEGIES } from "@/types/configuration"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface ConfigCarouselProps {
    configs: Configuration[]
    selectedId: string | null
    onSelect: (config: Configuration) => void
}

export function ConfigCarousel({ configs, selectedId, onSelect }: ConfigCarouselProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)

    const checkScroll = () => {
        if (scrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
            setCanScrollLeft(scrollLeft > 0)
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5)
        }
    }

    useEffect(() => {
        checkScroll()
        window.addEventListener("resize", checkScroll)
        return () => window.removeEventListener("resize", checkScroll)
    }, [configs])

    const scroll = (direction: "left" | "right") => {
        if (scrollRef.current) {
            const scrollAmount = 300
            scrollRef.current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth",
            })
            setTimeout(checkScroll, 300)
        }
    }

    const getModelName = (modelId: string) => {
        return LLM_MODELS.find(m => m.id === modelId)?.name || modelId
    }

    const getStrategyName = (strategyId: string) => {
        return BUILDER_STRATEGIES.find(s => s.id === strategyId)?.name || strategyId
    }

    return (
        <div className="relative group w-full">
            <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Configurations
                </h3>
                <div className="flex gap-1">
                    <button
                        onClick={() => scroll("left")}
                        disabled={!canScrollLeft}
                        className={cn(
                            "p-1 rounded-full hover:bg-muted transition-colors disabled:opacity-30",
                            !canScrollLeft && "cursor-not-allowed"
                        )}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => scroll("right")}
                        disabled={!canScrollRight}
                        className={cn(
                            "p-1 rounded-full hover:bg-muted transition-colors disabled:opacity-30",
                            !canScrollRight && "cursor-not-allowed"
                        )}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div
                ref={scrollRef}
                onScroll={checkScroll}
                className="flex gap-4 overflow-x-auto pb-4 px-1 no-scrollbar scroll-smooth"
            >
                {configs.map((config) => {
                    const isSelected = selectedId === config.id
                    return (
                        <div
                            key={config.id}
                            onClick={() => onSelect(config)}
                            className={cn(
                                "flex-shrink-0 w-[280px] p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 relative overflow-hidden group/card",
                                isSelected
                                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10 ring-1 ring-primary/20"
                                    : "border-border hover:border-primary/40 hover:bg-muted/30"
                            )}
                        >
                            {/* Selected Badge */}
                            {isSelected && (
                                <div className="absolute top-3 right-3 animate-in zoom-in duration-300">
                                    <CheckCircle2 className="h-5 w-5 text-primary fill-primary/10" />
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <div className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover/card:bg-primary/10 group-hover/card:text-primary"
                                    )}>
                                        {config.builderStrategy === 'semantic-chunking' ? <Zap className="h-4 w-4" /> : <Beaker className="h-4 w-4" />}
                                    </div>
                                    <span className="font-bold truncate text-sm uppercase tracking-tight">
                                        {config.name}
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center text-xs text-muted-foreground gap-1.5">
                                        <Cpu className="h-3.5 w-3.5" />
                                        <span className="truncate">{getModelName(config.model)}</span>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        <Badge variant="outline" className="text-[10px] py-0 h-4 font-medium uppercase tracking-tighter">
                                            {config.builderStrategy === 'semantic-chunking' ? 'Semantic Chunking' : 'Line-by-Line'}
                                        </Badge>
                                        <Badge variant="outline" className="text-[10px] py-0 h-4 font-medium uppercase tracking-tighter">
                                            Temp {config.temperature}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {/* Hover highlight effect */}
                            {!isSelected && (
                                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity pointer-events-none" />
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Gradient Mask for fading out edges */}
            <div className="absolute top-10 right-0 bottom-4 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
            <div className="absolute top-10 left-0 bottom-4 w-12 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
        </div>
    )
}
