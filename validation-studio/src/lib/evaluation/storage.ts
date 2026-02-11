import path from 'path';
import { GenericStorage, ValidationRecord } from '../configuration/storage-core';

const DATA_DIR = path.join(process.cwd(), 'data');
const EVALUATION_FILE_PATH = path.join(DATA_DIR, 'evaluation_history.json');

export class EvaluationStorage {
    static async getHistory(): Promise<ValidationRecord[]> {
        return GenericStorage.getHistory(EVALUATION_FILE_PATH);
    }

    static async saveEvaluation(record: ValidationRecord): Promise<void> {
        return GenericStorage.saveRecord(EVALUATION_FILE_PATH, record);
    }

    static async getEvaluationById(id: string): Promise<ValidationRecord | undefined> {
        return GenericStorage.getRecordById(EVALUATION_FILE_PATH, id);
    }

    static async deleteEvaluation(id: string): Promise<void> {
        return GenericStorage.deleteRecord(EVALUATION_FILE_PATH, id);
    }
}
