"use server"

import fs from "fs"
import path from "path"

export async function getWidgetDocs() {
    const filePath = path.join(process.cwd(), "src/components/dashboard/WIDGETS_DOCUMENTATION.md")
    return fs.readFileSync(filePath, "utf8")
}
