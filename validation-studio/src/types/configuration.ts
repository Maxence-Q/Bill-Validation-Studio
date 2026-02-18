import { z } from "zod"

export const LLM_MODELS = [
    { id: "gsk_groq_default", name: "Groq (Default)" },
    { id: "openai/gpt-oss-120b", name: "GPT-OSS-120B" },
    { id: "openai/gpt-oss-20b", name: "GPT-OSS-20B" },
] as const

export const PROMPT_LANGUAGES = [
    { id: "en", name: "English" },
    { id: "fr", name: "French" },
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
    language: z.enum(["en", "fr"]),
    references: z.number().int().min(1).max(4),
    slicing: z.object({
        mode: z.enum(["global", "custom"]),
        globalValue: z.number().min(1).max(100),
        moduleValues: z.record(z.string(), z.number().min(1).max(100)),
    }),
    createdAt: z.string().datetime(),
})

export type Configuration = z.infer<typeof configurationSchema>

export const defaultConfiguration: Omit<Configuration, "id" | "name" | "createdAt"> = {
    model: "openai/gpt-oss-20b",
    temperature: 0.0,
    language: "en",
    references: 2,
    slicing: {
        mode: "global",
        globalValue: 100,
        moduleValues: SLICING_MODULES.reduce((acc, module) => ({ ...acc, [module]: 100 }), {}),
    },
}
