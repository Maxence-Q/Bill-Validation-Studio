"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { ValidationRecord } from "@/lib/configuration/storage-core"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { FilterIcon, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface HistoryFilterBarProps {
    history: ValidationRecord[]
    onFilterChange: (filtered: ValidationRecord[]) => void
}

export function HistoryFilterBar({ history, onFilterChange }: HistoryFilterBarProps) {
    const [dateFilter, setDateFilter] = useState<string>("all")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [selectedEventNames, setSelectedEventNames] = useState<Set<string>>(new Set())
    const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set())

    // Extract unique values
    const uniqueEventNames = useMemo(() => {
        const names = new Set<string>()
        history.forEach(r => { if (r.eventName) names.add(r.eventName) })
        return Array.from(names).sort()
    }, [history])

    const uniqueEventIds = useMemo(() => {
        const ids = new Set<string>()
        history.forEach(r => { if (r.eventId) ids.add(String(r.eventId)) })
        return Array.from(ids).sort()
    }, [history])

    // Apply filters
    useEffect(() => {
        let filtered = [...history]

        // Date Filter
        if (dateFilter === "today") {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            filtered = filtered.filter(r => new Date(r.timestamp) >= today)
        } else if (dateFilter === "this_week") {
            const today = new Date()
            const firstDay = new Date(today.setDate(today.getDate() - today.getDay()))
            firstDay.setHours(0, 0, 0, 0)
            filtered = filtered.filter(r => new Date(r.timestamp) >= firstDay)
        }

        // Status Filter
        if (statusFilter !== "all") {
            filtered = filtered.filter(r => r.status === statusFilter)
        }

        // Event Name Filter
        if (selectedEventNames.size > 0) {
            filtered = filtered.filter(r => selectedEventNames.has(r.eventName || ""))
        }

        // Event ID Filter
        if (selectedEventIds.size > 0) {
            filtered = filtered.filter(r => selectedEventIds.has(String(r.eventId || "")))
        }

        onFilterChange(filtered)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [history, dateFilter, statusFilter, selectedEventNames, selectedEventIds])

    const resetFilters = () => {
        setDateFilter("all")
        setStatusFilter("all")
        setSelectedEventNames(new Set())
        setSelectedEventIds(new Set())
    }

    const toggleEventName = (name: string) => {
        const next = new Set(selectedEventNames)
        if (next.has(name)) {
            next.delete(name)
        } else {
            next.add(name)
        }
        setSelectedEventNames(next)
    }

    const toggleEventId = (id: string) => {
        const next = new Set(selectedEventIds)
        if (next.has(id)) {
            next.delete(id)
        } else {
            next.add(id)
        }
        setSelectedEventIds(next)
    }

    const hasActiveFilters = dateFilter !== "all" || statusFilter !== "all" || selectedEventNames.size > 0 || selectedEventIds.size > 0

    return (
        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-card rounded-lg border shadow-sm">
            <div className="flex items-center gap-2 mr-2">
                <div className="p-1.5 bg-primary/10 rounded-md">
                    <FilterIcon className="h-4 w-4 text-primary" />
                </div>
                <span className="font-semibold text-sm">Filters</span>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Date:</span>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-[140px] h-9">
                        <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="this_week">This week</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Event Name Filter */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Event Name:</span>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="h-9 border-dashed text-sm font-normal">
                            {selectedEventNames.size > 0 ? (
                                <div className="flex gap-2 items-center">
                                    <Badge variant="secondary" className="px-1 font-normal rounded-sm">
                                        {selectedEventNames.size} selected
                                    </Badge>
                                </div>
                            ) : (
                                "All"
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Search event names..." />
                            <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                    <CommandItem
                                        onSelect={() => setSelectedEventNames(new Set())}
                                        className="cursor-pointer font-medium mb-1"
                                    >
                                        <div className="flex items-center gap-2 w-full">
                                            <Checkbox
                                                checked={selectedEventNames.size === 0}
                                                onCheckedChange={() => setSelectedEventNames(new Set())}
                                                className="pointer-events-none"
                                            />
                                            <span className="flex-1">All</span>
                                        </div>
                                    </CommandItem>
                                    <CommandSeparator className="mb-1" />
                                    {uniqueEventNames.map(name => (
                                        <CommandItem
                                            key={name}
                                            value={name}
                                            onSelect={() => toggleEventName(name)}
                                            className="cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2 w-full">
                                                <Checkbox
                                                    checked={selectedEventNames.has(name)}
                                                    onCheckedChange={() => toggleEventName(name)}
                                                    className="pointer-events-none"
                                                />
                                                <span className="truncate flex-1" title={name}>{name}</span>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Event ID Filter */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Event ID:</span>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="h-9 border-dashed text-sm font-normal">
                            {selectedEventIds.size > 0 ? (
                                <div className="flex gap-2 items-center">
                                    <Badge variant="secondary" className="px-1 font-normal rounded-sm">
                                        {selectedEventIds.size} selected
                                    </Badge>
                                </div>
                            ) : (
                                "All"
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[240px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Search event IDs..." />
                            <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                    <CommandItem
                                        onSelect={() => setSelectedEventIds(new Set())}
                                        className="cursor-pointer font-medium mb-1"
                                    >
                                        <div className="flex items-center gap-2 w-full">
                                            <Checkbox
                                                checked={selectedEventIds.size === 0}
                                                onCheckedChange={() => setSelectedEventIds(new Set())}
                                                className="pointer-events-none"
                                            />
                                            <span className="flex-1">All</span>
                                        </div>
                                    </CommandItem>
                                    <CommandSeparator className="mb-1" />
                                    {uniqueEventIds.map(id => (
                                        <CommandItem
                                            key={id}
                                            value={id}
                                            onSelect={() => toggleEventId(id)}
                                            className="cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2 w-full">
                                                <Checkbox
                                                    checked={selectedEventIds.has(id)}
                                                    onCheckedChange={() => toggleEventId(id)}
                                                    className="pointer-events-none"
                                                />
                                                <span className="truncate flex-1">{id}</span>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Status:</span>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px] h-9">
                        <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Reset Filters */}
            {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="ml-auto h-9 px-3 text-muted-foreground hover:text-foreground">
                    Reset Filters
                    <X className="ml-2 h-4 w-4" />
                </Button>
            )}
        </div>
    )
}
