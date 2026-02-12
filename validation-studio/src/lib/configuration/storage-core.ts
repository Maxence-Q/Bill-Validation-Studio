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
    perturbations?: Record<string, { path: string; original: string; perturbed: string }[][]>;
    metrics?: {
        precision: number;
        recall: number;
        tp: number;
        fp: number;
        fn: number;
    };
    moduleMetrics?: Record<string, {
        precision: number;
        recall: number;
        tp: number;
        fp: number;
        fn: number;
    }>;
}

const DATA_DIR = path.join(process.cwd(), 'data');

async function ensureDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

export class GenericStorage {
    static async getHistory(filePath: string): Promise<ValidationRecord[]> {
        await ensureDir();
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }

    static async saveRecord(filePath: string, record: ValidationRecord): Promise<void> {
        await ensureDir();
        const history = await this.getHistory(filePath);
        history.unshift(record);
        if (history.length > 50) {
            history.length = 50;
        }
        await fs.writeFile(filePath, JSON.stringify(history, null, 2), 'utf-8');
    }

    static async getRecordById(filePath: string, id: string): Promise<ValidationRecord | undefined> {
        const history = await this.getHistory(filePath);
        return history.find(r => r.id === id);
    }

    static async deleteRecord(filePath: string, id: string): Promise<void> {
        await ensureDir();
        let history = await this.getHistory(filePath);
        history = history.filter(r => r.id !== id);
        await fs.writeFile(filePath, JSON.stringify(history, null, 2), 'utf-8');
    }
}
