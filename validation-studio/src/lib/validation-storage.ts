import fs from 'fs/promises';
import path from 'path';

export interface ValidationRecord {
    id: string;
    timestamp: string;
    eventId: string;
    eventName: string;
    status: "success" | "failed";
    issuesCount: number;
    issues: any[];
    prompts: any;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const FILE_PATH = path.join(DATA_DIR, 'validation_history.json');

async function ensureDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

export class ValidationStorage {
    static async getHistory(): Promise<ValidationRecord[]> {
        await ensureDir();
        try {
            const data = await fs.readFile(FILE_PATH, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            // If file doesn't exist or is empty, return empty array
            return [];
        }
    }

    static async saveValidation(record: ValidationRecord): Promise<void> {
        await ensureDir();
        const history = await this.getHistory();

        // Add new record at the beginning
        history.unshift(record);

        // Optional: Limit history size (e.g., keep last 50)
        if (history.length > 50) {
            history.length = 50;
        }

        await fs.writeFile(FILE_PATH, JSON.stringify(history, null, 2), 'utf-8');
    }

    static async getValidationById(id: string): Promise<ValidationRecord | undefined> {
        const history = await this.getHistory();
        return history.find(r => r.id === id);
    }

    static async deleteValidation(id: string): Promise<void> {
        await ensureDir();
        let history = await this.getHistory();
        history = history.filter(r => r.id !== id);
        await fs.writeFile(FILE_PATH, JSON.stringify(history, null, 2), 'utf-8');
    }
}
