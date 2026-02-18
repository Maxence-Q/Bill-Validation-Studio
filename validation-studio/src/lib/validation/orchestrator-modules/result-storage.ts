import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ValidationRecord } from '@/lib/configuration/storage-core';

/**
 * Storage Compartment (C4): Pure CRUD persistence.
 * 
 * Contract:
 *   save(record, type)     — persist a record
 *   getHistory(type)       — retrieve all records
 *   getRecord(type, id)    — retrieve a single record by ID
 *   deleteRecord(type, id) — remove a record
 * 
 * Does NOT construct records — that's the Orchestrator's responsibility.
 */
export class ResultStorage {
    private static getStoragePath(type: 'validation' | 'evaluation' = 'evaluation'): string {
        return path.join(process.cwd(), 'data', type === 'validation' ? 'validation_history.json' : 'evaluation_history.json');
    }

    private static ensureDir() {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    static getHistory(type: 'validation' | 'evaluation' = 'evaluation'): any[] {
        const storagePath = this.getStoragePath(type);
        if (!fs.existsSync(storagePath)) return [];
        try {
            const content = fs.readFileSync(storagePath, 'utf-8');
            return JSON.parse(content);
        } catch (e) {
            console.warn(`Failed to parse ${type} history`, e);
            return [];
        }
    }

    static getRecord(type: 'validation' | 'evaluation', id: string): any | null {
        const history = this.getHistory(type);
        return history.find((r: any) => r.id === id) || null;
    }

    static saveRecord(record: any, type: 'validation' | 'evaluation' = 'evaluation') {
        this.ensureDir();
        const storagePath = this.getStoragePath(type);
        let history = this.getHistory(type);

        // Add ID if missing
        if (!record.id) {
            record.id = uuidv4();
        }

        history.unshift(record);

        fs.writeFileSync(storagePath, JSON.stringify(history, null, 2));
    }

    static deleteRecord(id: string, type: 'validation' | 'evaluation' = 'evaluation') {
        this.ensureDir();
        const storagePath = this.getStoragePath(type);
        let history = this.getHistory(type);

        const initialLength = history.length;
        history = history.filter((r: any) => r.id !== id);

        if (history.length !== initialLength) {
            fs.writeFileSync(storagePath, JSON.stringify(history, null, 2));
        }
    }
}
