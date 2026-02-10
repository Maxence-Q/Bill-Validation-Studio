import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

const ARTEFACTS_DIR = path.join(process.cwd(), "artefacts")

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const lang = searchParams.get("lang")

    if (lang !== "fr" && lang !== "en") {
        return NextResponse.json({ error: "Invalid language. Must be 'fr' or 'en'" }, { status: 400 })
    }

    const filename = `tools_${lang}.json`
    const filePath = path.join(ARTEFACTS_DIR, filename)

    try {
        const content = await fs.readFile(filePath, "utf-8")
        return NextResponse.json({ content })
    } catch (error) {
        console.error(`Error reading ${filename}:`, error)
        // If file doesn't exist, return empty string instead of 404
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return NextResponse.json({ content: "{}" })
        }
        return NextResponse.json({ error: "Failed to read file" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { lang, content } = await request.json()

        if (lang !== "fr" && lang !== "en") {
            return NextResponse.json({ error: "Invalid language. Must be 'fr' or 'en'" }, { status: 400 })
        }

        if (typeof content !== "string") {
            return NextResponse.json({ error: "Invalid content" }, { status: 400 })
        }

        const filename = `tools_${lang}.json`
        const filePath = path.join(ARTEFACTS_DIR, filename)

        await fs.writeFile(filePath, content, "utf-8")

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error writing tools file:", error)
        return NextResponse.json({ error: "Failed to save file" }, { status: 500 })
    }
}
