import axios from "axios";

// Environment variables
const BILL_TS_API_URL = process.env.BILL_TS_API_URL || "";
const BILL_TS_API_KEY = process.env.BILL_TS_API_KEY || "";

/**
 * Helper function to fetch full event JSON from Bill API
 * @param eventId The ID of the event to fetch
 * @returns The full event JSON object
 */
export async function getTsApi(eventId: number) {
    if (!eventId) throw new Error("Invalid eventId");

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
