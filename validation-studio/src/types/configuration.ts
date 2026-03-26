import { z } from "zod"

export const LLM_MODELS = [
    { id: "gsk_groq_default", name: "Groq (Default)" },
    { id: "openai/gpt-oss-120b", name: "GPT-OSS-120B" },
    { id: "openai/gpt-oss-20b", name: "GPT-OSS-20B" },
] as const


export const EXECUTION_STRATEGIES = [
    { id: "single-pass", name: "Single Pass (Default)" },
    { id: "two-pass", name: "Two Pass Contextual" },
] as const

export const BUILDER_STRATEGIES = [
    { id: "line-by-line", name: "Line by Line Slicing" },
    { id: "semantic-chunking", name: "Semantic Chunking" }
] as const

export const SLICING_MODULES = [
    "Event",
    "EventDates",
    "OwnerPOS",
    "FeeDefinitions",
    "Prices",
    "PriceGroups",
    "RightToSellAndFees",
] as const

export const configurationSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1, "Name is required").max(50, "Name is too long"),
    model: z.string().min(1, "Model is required"),
    temperature: z.number().min(0).max(1).step(0.01),
    references: z.number().int().min(1).max(4),
    slicing: z.object({
        mode: z.enum(["global", "custom"]),
        globalValue: z.number().min(1).max(100),
        moduleValues: z.record(z.string(), z.number().min(1).max(100)),
    }),
    reasoningEffort: z.enum(["low", "medium", "high"]),
    executionStrategy: z.enum(["single-pass", "two-pass"]),
    builderStrategy: z.enum(["line-by-line", "semantic-chunking"]),
    createdAt: z.string().datetime(),
})

export type Configuration = z.infer<typeof configurationSchema>

export const defaultConfiguration: Omit<Configuration, "id" | "name" | "createdAt"> = {
    model: "openai/gpt-oss-20b",
    temperature: 0.0,
    references: 3,
    slicing: {
        mode: "global",
        globalValue: 10,
        moduleValues: SLICING_MODULES.reduce((acc, module) => ({ ...acc, [module]: 10 }), {}),
    },
    reasoningEffort: "medium",
    executionStrategy: "single-pass",
    builderStrategy: "semantic-chunking",
}
