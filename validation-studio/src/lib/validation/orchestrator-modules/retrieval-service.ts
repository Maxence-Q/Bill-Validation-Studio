import { QdrantClient } from "@qdrant/js-client-rest";

// Environment variables
const QDRANT_URL = process.env.QDRANT_URL || "";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || "";

// Constants
const COLLECTION = "similar_events_codewords_bgem3";
const DENSE_NAME = "main_dense_vector";

const qdrant = new QdrantClient({
    url: QDRANT_URL,
    apiKey: QDRANT_API_KEY,
});

/**
 * RAG Compartment (C5): Pure vector search.
 * 
 * Input:  eventId: number
 * Output: number[] — list of similar event IDs
 * 
 * Does NOT fetch event data — that's the API compartment's responsibility.
 * The Orchestrator calls RAG → gets IDs → then calls API to fetch events.
 */
export interface RetrievalResult {
    id: number;
    score: number;
    payload: any;
}

export class RetrievalService {
    static async retrieveDetailedContext(eventId: number, limit: number = 4): Promise<RetrievalResult[]> {
        const fetchLimit = Math.max(limit, 4);

        try {
            const filter = {
                must_not: [{ has_id: [eventId] }]
            };

            const results = await qdrant.recommend(COLLECTION, {
                positive: [eventId],
                limit: fetchLimit,
                using: DENSE_NAME,
                filter: filter,
                with_payload: true
            });

            console.log(`[Retrieval] Found ${results.length} results for eventId ${eventId}`);

            return results.map((point: any) => ({
                id: typeof point.id === 'string' ? parseInt(point.id) : point.id,
                score: point.score,
                payload: point.payload
            }));

        } catch (error) {
            console.error("Context retrieval error:", error);
            return [];
        }
    }

    static async retrieveContext(eventId: number, limit: number = 4): Promise<number[]> {
        const results = await this.retrieveDetailedContext(eventId, limit);
        return results.map(r => r.id);
    }
}
