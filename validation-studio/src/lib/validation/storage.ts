import path from 'path';
import { GenericStorage, ValidationRecord } from '../configuration/storage-core';

const DATA_DIR = path.join(process.cwd(), 'data');
const VALIDATION_FILE_PATH = path.join(DATA_DIR, 'validation_history.json');

export class ValidationStorage {
    static async getHistory(): Promise<ValidationRecord[]> {
        return GenericStorage.getHistory(VALIDATION_FILE_PATH);
    }

    static async saveValidation(record: ValidationRecord): Promise<void> {
        return GenericStorage.saveRecord(VALIDATION_FILE_PATH, record);
    }

    static async getValidationById(id: string): Promise<ValidationRecord | undefined> {
        return GenericStorage.getRecordById(VALIDATION_FILE_PATH, id);
    }

    static async deleteValidation(id: string): Promise<void> {
        return GenericStorage.deleteRecord(VALIDATION_FILE_PATH, id);
    }
}
