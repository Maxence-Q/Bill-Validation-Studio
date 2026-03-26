"use server"

import fs from "fs/promises"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const EVENTS_FILE = path.join(DATA_DIR, "events.json")

const API_URL = process.env.BILL_TS_API_URL?.replace(/\/$/, "") || ""
const API_KEY = process.env.BILL_TS_API_KEY || ""

interface EventSummary {
    ID: number
    NameFR: string
}

export async function refreshEventList(): Promise<EventSummary[]> {
    try {
        if (!API_URL) {
            console.warn("BILL_TS_API_URL is not defined")
            throw new Error("API URL not configured")
        }

        const response = await fetch(`${API_URL}/bill/events`, {
            headers: {
                'rese566': API_KEY
            },
            cache: "no-store",
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch events: ${response.statusText}`)
        }

        const allEvents = await response.json()

        // Filter to keep only ID and NameFR
        const simplifiedEvents: EventSummary[] = allEvents.map((event: any) => ({
            ID: event.ID,
            NameFR: event.NameFr || event.NameFR || "",
        }))

        // Ensure data directory exists
        try {
            await fs.access(DATA_DIR)
        } catch {
            await fs.mkdir(DATA_DIR, { recursive: true })
        }

        // Write to file
        await fs.writeFile(EVENTS_FILE, JSON.stringify(simplifiedEvents, null, 2))

        return simplifiedEvents
    } catch (error) {
        console.error("Error fetching event list:", error)
        // Try to read from file if fetch fails
        try {
            const fileContent = await fs.readFile(EVENTS_FILE, "utf-8")
            const savedEvents = JSON.parse(fileContent)
            return savedEvents.map((event: any) => ({
                ID: event.ID,
                NameFR: event.NameFR || "",
            }))
        } catch {
            return []
        }
    }
}

export async function getEventConfig(id: number): Promise<any> {
    try {
        if (!API_URL) {
            throw new Error("API URL not configured")
        }

        const response = await fetch(`${API_URL}/bill/events/${id}/fullconfig`, {
            headers: {
                'rese566': API_KEY
            },
            cache: "no-store"
        })

        if (!response.ok) {
            throw new Error(`Failed to fetch event config: ${response.statusText}`)
        }

        return await response.json()
    } catch (error) {
        console.error(`Error fetching config for event ${id}:`, error)
        throw error // Re-throw so the UI knows it failed
    }
}

export async function searchEvents(query: string): Promise<EventSummary[]> {
    try {
        const fileContent = await fs.readFile(EVENTS_FILE, "utf-8")
        const savedEvents = JSON.parse(fileContent)

        if (!query) return savedEvents.slice(0, 50)

        const lowerQuery = query.toLowerCase()
        return savedEvents
            .filter((event: any) =>
                (event.NameFR || "").toLowerCase().includes(lowerQuery) ||
                event.ID.toString().includes(lowerQuery)
            )
            .slice(0, 50)
            .map((event: any) => ({
                ID: event.ID,
                NameFR: event.NameFR || "",
            }))
    } catch {
        return []
    }
}
