import { Command as CommandPrimitive } from "cmdk"
import * as React from "react"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import { getEventConfig, searchEvents } from "@/app/actions"
import { toast } from "sonner"

interface EventSummary {
    ID: number
    NameFR: string
}

interface SearchEventsProps {
    onSelect: (data: any) => void
}

function useDebounceValue<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => {
            clearTimeout(timer)
        }
    }, [value, delay])

    return debouncedValue
}

export function SearchEvents({ onSelect }: SearchEventsProps) {
    const [query, setQuery] = React.useState("")
    const debouncedQuery = useDebounceValue(query, 300)
    const [results, setResults] = React.useState<EventSummary[]>([])
    const [loading, setLoading] = React.useState(false)
    const [fetchingConfig, setFetchingConfig] = React.useState(false)
    const [open, setOpen] = React.useState(false)

    React.useEffect(() => {
        const fetchEvents = async () => {
            setLoading(true)
            try {
                const data = await searchEvents(debouncedQuery)
                setResults(data)
            } catch (error) {
                console.error("Failed to search events", error)
            } finally {
                setLoading(false)
            }
        }

        fetchEvents()
    }, [debouncedQuery])

    const handleSelect = async (idStr: string) => {
        setFetchingConfig(true)
        setOpen(false)
        try {
            const id = parseInt(idStr)
            const config = await getEventConfig(id)
            if (config) {
                onSelect(config)
                toast.success("Event loaded successfully")
                setQuery("") // Optional: clear search after selection
            } else {
                toast.error("Event data was empty or invalid")
            }
        } catch (error) {
            console.error("Failed to load event:", error)
            toast.error("Failed to load event configuration (Possible SSL error on staging)")
        } finally {
            setFetchingConfig(false)
        }
    }

    return (
        <div className="relative w-full max-w-xl">
            <Command
                shouldFilter={false}
                className="rounded-xl border-2 shadow-lg overflow-visible relative z-50 bg-popover"
            >
                <div className="flex h-14 items-center gap-3 border-b px-4">
                    <CommandPrimitive.Input
                        placeholder="Search event by name or ID..."
                        value={query}
                        onValueChange={(val) => {
                            setQuery(val)
                            setOpen(true)
                        }}
                        onFocus={() => setOpen(true)}
                        className="flex h-full w-full rounded-md bg-transparent py-3 text-lg outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>

                {open && (query || loading) && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-popover rounded-md border shadow-lg overflow-hidden z-50">
                        <CommandList>
                            {loading && (
                                <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                                </div>
                            )}
                            {!loading && results.length === 0 && (
                                <CommandEmpty>No results found.</CommandEmpty>
                            )}
                            {!loading && results.length > 0 && (
                                <CommandGroup heading="Events">
                                    {results.map((event) => (
                                        <CommandItem
                                            key={event.ID}
                                            value={event.ID.toString()}
                                            onSelect={handleSelect}
                                        >
                                            <span className="truncate">
                                                <span className="font-mono text-xs text-muted-foreground mr-2">#{event.ID}</span>
                                                {event.NameFR || "Untitled"}
                                            </span>
                                            {fetchingConfig && (
                                                <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                                            )}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </div>
                )}
            </Command>
        </div>
    )
}
