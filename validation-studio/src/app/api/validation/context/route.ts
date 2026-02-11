import { NextRequest, NextResponse } from "next/server";
import { QdrantClient } from "@qdrant/js-client-rest";
import axios from "axios";

// Environment variables
const QDRANT_URL = process.env.QDRANT_URL || "";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || "";
const BILL_TS_API_URL = process.env.BILL_TS_API_URL || "";
const BILL_TS_API_KEY = process.env.BILL_TS_API_KEY || "";

// Constants
const COLLECTION = "similar_events_codewords_bgem3";
const DENSE_NAME = "main_dense_vector";

// Initialize Qdrant client
const client = new QdrantClient({
    url: QDRANT_URL,
    apiKey: QDRANT_API_KEY,
});

// Helper function to fetch full event JSON from Bill API
async function getTsApi(eventId: number) {
    const path = `bill/events/${eventId}/fullconfig`;
    // Ensure clean URL construction
    const baseUrl = BILL_TS_API_URL.endsWith('/') ? BILL_TS_API_URL.slice(0, -1) : BILL_TS_API_URL;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const url = `${baseUrl}/${cleanPath}`;

    try {
        const response = await axios.get(url, {
            headers: { 'rese566': BILL_TS_API_KEY },
            timeout: 10000 // 10s timeout
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching event ${eventId} from API:`, error);
        throw error;
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { eventId, refCount } = body;

        if (!eventId || typeof eventId !== 'number') {
            return NextResponse.json({ error: "Invalid or missing eventId" }, { status: 400 });
        }

        const topK = typeof refCount === 'number' && refCount > 0 ? refCount : 2;

        // 1. Query Qdrant for similar events
        // Using "query" (search) - similar_by_id logic in rag.py uses query_points with positive=[eid]
        // But query_points in JS client might map differently. 
        // Rag.py uses: client.query_points(collection_name, query=eid, using=DENSE_NAME...)
        // This suggests searching by ID (recommendation/search-by-id)

        // In @qdrant/js-client-rest, we can use search or retrieve. 
        // To find similar points to an existing point ID, we usually use 'recommend' API.
        // However, the python code uses `query_points` with `query=eid`. This is likely the new Query API.
        // The JS client v1.11+ supports query() method.

        // Let's try to mimic the Python behavior as closely as possible.
        // If the ID exists in the collection, we can use it as a reference.

        let similarIds: number[] = [];

        try {
            // Using the recommend API which is standard for "similar to existing ID"
            // Filter to exclude the query ID itself
            const filter = {
                must_not: [
                    {
                        has_id: [eventId]
                    }
                ]
            };

            const results = await client.recommend(COLLECTION, {
                positive: [eventId],
                limit: topK,
                using: DENSE_NAME,
                filter: filter,
                with_payload: true
            });

            similarIds = results.map((point: any) => typeof point.id === 'string' ? parseInt(point.id) : point.id);

        } catch (qdrantError) {
            console.error("Qdrant query error:", qdrantError);
            return NextResponse.json({ error: "Failed to query similar events from vector DB" }, { status: 500 });
        }

        if (similarIds.length === 0) {
            return NextResponse.json({
                message: "No similar events found",
                similarIds: [],
                events: []
            });
        }

        // 2. Fetch full JSONs from Bill API
        const eventsData: Record<number, any> = {};

        // Also fetch the target event itself if needed, but the user says "we already have because the user uploads it"
        // The prompt says: "This step is considered done if it returns, to the main file, 2 ids and 2 full event json"

        const fetchPromises = similarIds.map(async (id) => {
            try {
                const data = await getTsApi(id);
                return { id, data };
            } catch (e) {
                console.error(`Failed to fetch event ${id}`);
                return null;
            }
        });

        const fetchedResults = await Promise.all(fetchPromises);

        // Filter out failed fetches
        const validResults = fetchedResults.filter(r => r !== null) as { id: number, data: any }[];

        // Check if we have enough
        if (validResults.length < topK) {
            console.warn(`Requested ${topK} references but only successfully fetched ${validResults.length}`);
        }

        return NextResponse.json({
            similarIds: validResults.map(r => r.id),
            events: validResults.map(r => r.data)
        });

    } catch (error) {
        console.error("Context retrieval error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
