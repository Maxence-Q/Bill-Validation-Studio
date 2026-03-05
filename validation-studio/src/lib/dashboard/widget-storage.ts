/**
 * Widget Storage Layer (Server-side)
 *
 * Reads/writes isolated JSON files in data/widgets/.
 * Source of truth: src/components/dashboard/WIDGET_STORAGE.md
 *
 * This module must only be imported in server contexts (API routes, server
 * components) because it uses Node `fs`.
 */

import { promises as fs } from "fs"
import path from "path"
import { Widget, WidgetDefinition, WidgetSnapshot, WidgetSummary } from "@/types/widget"

// ─── Constants ───────────────────────────────────────────────────────────────

const WIDGETS_DIR = path.join(process.cwd(), "data", "widgets")
const DEFAULT_PANEL_ID = "default-panel"
const DEFAULT_PANEL_FILE = `${DEFAULT_PANEL_ID}.json`

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureDir() {
    await fs.mkdir(WIDGETS_DIR, { recursive: true })
}

function widgetPath(id: string): string {
    // Sanitise to prevent directory traversal
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, "")
    return path.join(WIDGETS_DIR, `${safe}.json`)
}

async function readWidget(filePath: string): Promise<Widget> {
    const raw = await fs.readFile(filePath, "utf-8")
    return JSON.parse(raw) as Widget
}

async function writeWidget(filePath: string, widget: Widget): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(widget, null, 2), "utf-8")
}

function toSummary(w: Widget): WidgetSummary {
    return {
        id: w.id,
        type: w.type,
        name: w.name,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        description: w.description,
        isRemovable: w.isRemovable,
        snapshotCount: w.snapshots?.length ?? 0,
    }
}

// ─── Default Panel Seed ──────────────────────────────────────────────────────

const DEFAULT_PANEL_SEED: Widget = {
    id: DEFAULT_PANEL_ID,
    type: "default_panel",
    name: "Performance Overview",
    createdAt: "2026-02-26T00:00:00.000Z",
    updatedAt: "2026-02-26T00:00:00.000Z",
    isRemovable: false,
    description: "High-level Precision & Recall across all modules and runs.",
    definition: {
        query: {
            runSelection: { type: "latest", count: 0 },
            scope: { modules: [], perturbationTypes: [] },
            metrics: ["precision", "recall"],
            groupBy: "module",
            aggregation: null,
        },
    },
    snapshots: [],
}

/**
 * Ensure the default panel file exists. Called automatically before listing.
 */
export async function ensureDefaultPanel(): Promise<void> {
    await ensureDir()
    const fp = path.join(WIDGETS_DIR, DEFAULT_PANEL_FILE)
    try {
        await fs.access(fp)
    } catch {
        await writeWidget(fp, DEFAULT_PANEL_SEED)
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * List all widgets as lightweight summaries. Default panel is always first.
 */
export async function listWidgets(): Promise<WidgetSummary[]> {
    await ensureDefaultPanel()

    const files = await fs.readdir(WIDGETS_DIR)
    const jsonFiles = files.filter((f) => f.endsWith(".json"))

    const summaries: WidgetSummary[] = []
    let defaultSummary: WidgetSummary | null = null

    for (const file of jsonFiles) {
        try {
            const widget = await readWidget(path.join(WIDGETS_DIR, file))
            const summary = toSummary(widget)
            if (widget.id === DEFAULT_PANEL_ID) {
                defaultSummary = summary
            } else {
                summaries.push(summary)
            }
        } catch (err) {
            console.error(`[widget-storage] Failed to read ${file}:`, err)
        }
    }

    // Default panel always first
    if (defaultSummary) {
        summaries.unshift(defaultSummary)
    }

    return summaries
}

/**
 * Load a single widget by ID (full data including snapshots).
 */
export async function loadWidget(id: string): Promise<Widget> {
    const fp = widgetPath(id)
    return readWidget(fp)
}

/**
 * Create a new widget. Returns the created widget.
 */
export async function createWidget(widget: Widget): Promise<Widget> {
    await ensureDir()
    const fp = widgetPath(widget.id)

    // Check for collision
    try {
        await fs.access(fp)
        throw new Error(`Widget with id "${widget.id}" already exists.`)
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("already exists")) throw err
        // File doesn't exist — good
    }

    await writeWidget(fp, widget)
    return widget
}

/**
 * Update the definition portion of an existing widget.
 */
export async function saveWidgetDefinition(id: string, definition: WidgetDefinition): Promise<Widget> {
    const fp = widgetPath(id)
    const widget = await readWidget(fp)
    widget.definition = definition
    widget.updatedAt = new Date().toISOString()
    await writeWidget(fp, widget)
    return widget
}

/**
 * Append a snapshot to the widget's snapshots array.
 */
export async function appendSnapshot(id: string, snapshot: WidgetSnapshot): Promise<Widget> {
    const fp = widgetPath(id)
    const widget = await readWidget(fp)
    widget.snapshots.push(snapshot)
    widget.updatedAt = new Date().toISOString()
    await writeWidget(fp, widget)
    return widget
}

/**
 * Delete a widget file. Refuses to delete the default panel.
 */
export async function deleteWidget(id: string): Promise<void> {
    if (id === DEFAULT_PANEL_ID) {
        throw new Error("The default panel cannot be deleted.")
    }
    const fp = widgetPath(id)
    await fs.unlink(fp)
}
