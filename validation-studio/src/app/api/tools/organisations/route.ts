import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

const ARTEFACTS_DIR = path.join(process.cwd(), "artefacts")
const FILENAME = "organisations.yaml"
const FILE_PATH = path.join(ARTEFACTS_DIR, FILENAME)

export async function GET(request: NextRequest) {
    try {
        const content = await fs.readFile(FILE_PATH, "utf-8")
        return NextResponse.json({ content })
    } catch (error) {
        console.error(`Error reading ${FILENAME}:`, error)
        // If file doesn't exist, return empty string instead of 404 to avoid breaking UI
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return NextResponse.json({ content: "" })
        }
        return NextResponse.json({ error: "Failed to read file" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { content } = await request.json()

        if (typeof content !== "string") {
            return NextResponse.json({ error: "Invalid content" }, { status: 400 })
        }

        await fs.writeFile(FILE_PATH, content, "utf-8")

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error(`Error writing ${FILENAME}:`, error)
        return NextResponse.json({ error: "Failed to save file" }, { status: 500 })
    }
}
