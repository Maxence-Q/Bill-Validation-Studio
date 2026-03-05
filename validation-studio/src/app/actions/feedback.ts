"use server"

import fs from "fs/promises"
import path from "path"
import OpenAI from "openai"

const DATA_DIR = path.join(process.cwd(), "data")

const getFilePath = (type: 'evaluation' | 'validation') => {
    return path.join(DATA_DIR, `${type}_feedback.json`)
}

async function ensureDir() {
    try {
        await fs.access(DATA_DIR)
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true })
    }
}

export interface FeedbackData {
    eventId: string | number;
    date: string;
    modules: Record<string, string[]>; // e.g. { "Prices": ["Feedback for prompt 1", "Feedback for prompt 2"] }
}

export async function getFeedback(eventId: string | number, date: string, type: 'evaluation' | 'validation'): Promise<FeedbackData | null> {
    const filePath = getFilePath(type)
    try {
        const data = await fs.readFile(filePath, "utf-8")
        const allFeedback: FeedbackData[] = JSON.parse(data)

        const matched = allFeedback.find(f => f.eventId.toString() === eventId.toString() && f.date === date)
        return matched || null
    } catch (e) {
        // File might not exist
        return null
    }
}

export async function saveFeedback(eventId: string | number, date: string, type: 'evaluation' | 'validation', feedbackData: Record<string, string[]>): Promise<void> {
    await ensureDir()
    const filePath = getFilePath(type)
    let allFeedback: FeedbackData[] = []

    try {
        const data = await fs.readFile(filePath, "utf-8")
        allFeedback = JSON.parse(data)
    } catch (e) {
        // Assume empty if read fails
    }

    const index = allFeedback.findIndex(f => f.eventId.toString() === eventId.toString() && f.date === date)

    if (index >= 0) {
        allFeedback[index].modules = feedbackData
    } else {
        allFeedback.push({
            eventId,
            date,
            modules: feedbackData
        })
    }

    await fs.writeFile(filePath, JSON.stringify(allFeedback, null, 2), "utf-8")
}

export async function generateFeedback(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = process.env.GROQ_API_PAID_KEY || ""
    const baseUrl = "https://api.groq.com/openai/v1"

    if (!apiKey) {
        console.warn("No GROQ API KEY provided. LLM feedback generation可能会失败")
    }

    const client = new OpenAI({
        apiKey,
        baseURL: baseUrl
    })

    try {
        const response = await client.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        })

        return response.choices[0].message.content || "No feedback generated."
    } catch (error) {
        console.error("Failed to generate LLM feedback", error)
        throw error
    }
}
