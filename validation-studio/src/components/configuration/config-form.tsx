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
} from "@/types/configuration"
import { useEffect } from "react"
import { v4 as uuidv4 } from "uuid"

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
            }
            : {
                name: "",
                ...defaultConfiguration,
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
            })
        } else {
            form.reset({
                name: "",
                ...defaultConfiguration,
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

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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

                <div className="flex justify-end space-x-2 pt-4">
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
