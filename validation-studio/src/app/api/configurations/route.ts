import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const FILENAME = "configurations.json"
const FILE_PATH = path.join(DATA_DIR, FILENAME)

export async function GET(request: NextRequest) {
    try {
        const content = await fs.readFile(FILE_PATH, "utf-8")
        return NextResponse.json(JSON.parse(content))
    } catch (error) {
        console.error(`Error reading ${FILENAME}:`, error)
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return NextResponse.json([])
        }
        return NextResponse.json({ error: "Failed to read configurations" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const configs = await request.json()

        if (!Array.isArray(configs)) {
            return NextResponse.json({ error: "Invalid data format. Expected an array." }, { status: 400 })
        }

        await fs.writeFile(FILE_PATH, JSON.stringify(configs, null, 2), "utf-8")

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error(`Error writing ${FILENAME}:`, error)
        return NextResponse.json({ error: "Failed to save configurations" }, { status: 500 })
    }
}
