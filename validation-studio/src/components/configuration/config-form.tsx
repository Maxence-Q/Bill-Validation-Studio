"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
    Configuration,
    configurationSchema,
    defaultConfiguration,
    LLM_MODELS,
    PROMPT_LANGUAGES,
    EXECUTION_STRATEGIES,
    BUILDER_STRATEGIES,
} from "@/types/configuration"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { useEffect } from "react"
import { v4 as uuidv4 } from "uuid"

const SLICING_VALUES = [1, 10, 25, 33, 50, 100]

// Schema for the form (excludes id and createdAt which are handled on submit)
const formSchema = configurationSchema.omit({ id: true, createdAt: true })
type FormValues = z.infer<typeof formSchema>

interface ConfigFormProps {
    initialData?: Configuration | null
    onSubmit: (data: Configuration) => void
    onCancel: () => void
}

export function ConfigForm({ initialData, onSubmit, onCancel }: ConfigFormProps) {
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: initialData
            ? {
                name: initialData.name,
                model: initialData.model,
                temperature: initialData.temperature,
                language: initialData.language,
                references: initialData.references,
                slicing: initialData.slicing || defaultConfiguration.slicing,
                reasoningEffort: initialData.reasoningEffort || "medium",
                executionStrategy: initialData.executionStrategy || "single-pass",
                builderStrategy: initialData.builderStrategy || "semantic-chunking",
            }
            : {
                name: "",
                ...defaultConfiguration,
                builderStrategy: "semantic-chunking",
            },
    })

    // Reset form when initialData changes (for switching between add/edit)
    useEffect(() => {
        if (initialData) {
            form.reset({
                name: initialData.name,
                model: initialData.model,
                temperature: initialData.temperature,
                language: initialData.language,
                references: initialData.references,
                slicing: initialData.slicing || defaultConfiguration.slicing,
                reasoningEffort: initialData.reasoningEffort || "medium",
                executionStrategy: initialData.executionStrategy || "single-pass",
                builderStrategy: initialData.builderStrategy || "semantic-chunking",
            })
        } else {
            form.reset({
                name: "",
                ...defaultConfiguration,
                builderStrategy: "semantic-chunking",
            })
        }
    }, [initialData, form])

    const handleSubmit = (values: FormValues) => {
        const config: Configuration = {
            id: initialData?.id || uuidv4(),
            createdAt: initialData?.createdAt || new Date().toISOString(),
            ...values,
        }
        onSubmit(config)
    }

    const slicingMode = form.watch("slicing.mode")

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <Tabs defaultValue="main" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="main">Main Configuration</TabsTrigger>
                        <TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
                        <TabsTrigger value="strategies">Execution Strategies</TabsTrigger>
                    </TabsList>

                    <TabsContent value="main" className="space-y-6 py-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Configuration Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="My Custom Config" {...field} />
                                    </FormControl>
                                    <FormDescription>
                                        A unique name to identify this configuration.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="model"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>LLM Model</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a model" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {LLM_MODELS.map((model) => (
                                                    <SelectItem key={model.id} value={model.id}>
                                                        {model.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            The model used for event validation.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="language"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Prompt Language</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select language" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {PROMPT_LANGUAGES.map((lang) => (
                                                    <SelectItem key={lang.id} value={lang.id}>
                                                        {lang.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            Language for the validation prompts.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="references"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Number of References: {field.value}</FormLabel>
                                    <FormControl>
                                        <Slider
                                            min={1}
                                            max={4}
                                            step={1}
                                            value={[field.value]}
                                            onValueChange={(vals) => field.onChange(vals[0])}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Number of reference examples to include in the prompt.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </TabsContent>

                    <TabsContent value="advanced" className="space-y-6 py-4">
                        <FormField
                            control={form.control}
                            name="temperature"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Temperature: {field.value.toFixed(2)}</FormLabel>
                                    <FormControl>
                                        <Slider
                                            min={0}
                                            max={1}
                                            step={0.01}
                                            value={[field.value]}
                                            onValueChange={(vals) => field.onChange(vals[0])}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Controls randomness (0 = deterministic, 1 = creative).
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="reasoningEffort"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reasoning Level</FormLabel>
                                    <FormControl>
                                        <div className="flex gap-2">
                                            {(["low", "medium", "high"] as const).map((level) => (
                                                <Button
                                                    key={level}
                                                    type="button"
                                                    variant={field.value === level ? "default" : "outline"}
                                                    onClick={() => field.onChange(level)}
                                                    className="flex-1 capitalize"
                                                >
                                                    {level}
                                                </Button>
                                            ))}
                                        </div>
                                    </FormControl>
                                    <FormDescription>
                                        The level of reasoning effort the model should apply.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-4 border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="text-sm font-medium">Slicing Configuration</h4>
                                    <p className="text-xs text-muted-foreground">Control division into sub-prompts used</p>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="slicing.mode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                value={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="w-[140px]">
                                                        <SelectValue placeholder="Mode" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="global">Global</SelectItem>
                                                    <SelectItem value="custom">Custom</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {slicingMode === 'global' ? (
                                <FormField
                                    control={form.control}
                                    name="slicing.globalValue"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex justify-between mb-2">
                                                <FormLabel>Global Slicing</FormLabel>
                                                <span className="text-sm font-mono text-muted-foreground">{field.value}%</span>
                                            </div>
                                            <FormControl>
                                                <Slider
                                                    min={0}
                                                    max={SLICING_VALUES.length - 1}
                                                    step={1}
                                                    value={[SLICING_VALUES.indexOf(field.value) !== -1 ? SLICING_VALUES.indexOf(field.value) : SLICING_VALUES.length - 1]}
                                                    onValueChange={(vals) => field.onChange(SLICING_VALUES[vals[0]])}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ) : (
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                    {Object.keys(defaultConfiguration.slicing.moduleValues).map((module) => (
                                        <FormField
                                            key={module}
                                            control={form.control}
                                            name={`slicing.moduleValues.${module}`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <div className="flex justify-between mb-1">
                                                        <FormLabel className="text-xs">{module}</FormLabel>
                                                        <span className="text-xs font-mono text-muted-foreground">{field.value}%</span>
                                                    </div>
                                                    <FormControl>
                                                        <Slider
                                                            min={0}
                                                            max={SLICING_VALUES.length - 1}
                                                            step={1}
                                                            value={[SLICING_VALUES.indexOf(field.value) !== -1 ? SLICING_VALUES.indexOf(field.value) : SLICING_VALUES.length - 1]}
                                                            onValueChange={(vals) => field.onChange(SLICING_VALUES[vals[0]])}
                                                            className="h-4"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="strategies" className="space-y-6 py-4">
                        <Accordion type="single" collapsible defaultValue="builder">
                            <AccordionItem value="builder">
                                <AccordionTrigger className="hover:no-underline">
                                    <div className="flex flex-col items-start gap-1 text-left">
                                        <span className="font-semibold">Builder Strategy</span>
                                        <span className="text-xs font-normal text-muted-foreground mt-1">
                                            Determines how large JSON structures are sliced for the LLM.
                                        </span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-4 px-2">
                                    <FormField
                                        control={form.control}
                                        name="builderStrategy"
                                        render={({ field }) => (
                                            <FormItem>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select builder strategy" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {BUILDER_STRATEGIES.map((strategy) => (
                                                            <SelectItem key={strategy.id} value={strategy.id}>
                                                                {strategy.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="mt-4 text-sm bg-muted p-3 rounded-md space-y-2">
                                        <p><strong>Line by Line Slicing:</strong> Slices the flattened JSON sequentially. Best for wide data rows using strict structural rule evaluations.</p>
                                        <p><strong>Semantic Chunking:</strong> Groups semantically related fields into structured summaries, significantly reducing token usage while preserving context.</p>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="execution">
                                <AccordionTrigger className="hover:no-underline">
                                    <div className="flex flex-col items-start gap-1 text-left">
                                        <span className="font-semibold">Execution Strategy</span>
                                        <span className="text-xs font-normal text-muted-foreground mt-1">
                                            Determines how the LLM handles the chunked data and filters anomalies.
                                        </span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-4 px-2">
                                    <FormField
                                        control={form.control}
                                        name="executionStrategy"
                                        render={({ field }) => (
                                            <FormItem>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value}
                                                    value={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select execution strategy" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {EXECUTION_STRATEGIES.map((strategy) => (
                                                            <SelectItem key={strategy.id} value={strategy.id}>
                                                                {strategy.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="mt-4 text-sm bg-muted p-3 rounded-md space-y-2">
                                        <p><strong>Single-Pass:</strong> Fastest execution. Processes chunks once and flags all anomalies immediately. Good for baseline metrics.</p>
                                        <p><strong>Two-Pass:</strong> Higher latency, but captures event context. Sends a second 'reviewer' prompt to filter out known operational workarounds (e.g., dummy dates 2038) to reduce false positives.</p>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </TabsContent>
                </Tabs>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                    <Button variant="outline" type="button" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit">
                        {initialData ? "Save Changes" : "Create Configuration"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
