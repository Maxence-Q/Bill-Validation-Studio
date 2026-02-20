export type ValidationStatus = 'loading' | 'success' | 'error' | 'warning' | 'pending';

export interface ValidationStep {
    id: string;
    label: string;
    status: ValidationStatus;
}

export interface ValidationIssue {
    module: string;
    issueId: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    suggestion?: string;
    path?: string;
    classification?: 'TP' | 'FP';
    /** Index of the parent element within the module (for list modules like Prices) */
    itemIndex?: number;
}

// Discriminator for stream messages
export type StreamMessage =
    | { type: 'progress'; module: string; current: number; total: number; status?: 'running' | 'completed' }
    | { type: 'result'; message: string; issues: ValidationIssue[]; prompts: any; metrics: any }
    | { type: 'error'; message: string };

/**
 * Structured data for a single validation prompt
 */
export interface DataItem {
    /** Target event data as key-value pairs (e.g. "Event.Name": "Concerto") */
    target: Record<string, string>;
    /** Reference events data as a list of key-value pair records */
    references: Record<string, string>[];
    /** Rules for each attribute (optional) */
    rules?: Record<string, string>;
}
