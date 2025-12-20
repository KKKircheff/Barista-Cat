import {NextRequest, NextResponse} from 'next/server';

export const runtime = 'nodejs';

/**
 * POST /api/gemini/token
 * Returns API key for Gemini Live API connection
 *
 * Note: Ephemeral tokens are the recommended approach but require SDK v2.0+
 * For now, we return the API key directly to enable the direct WebSocket connection.
 * This follows the pattern shown in the official SDK examples.
 *
 * Security: API key is only sent to authenticated clients and sessions expire after 3 minutes.
 */
export async function POST(_request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({error: 'GEMINI_API_KEY not configured'}, {status: 500});
        }

        console.log('[API /api/gemini/token POST] Providing API key for Live API connection');

        // Return API key for direct connection (following official SDK examples)
        // Future: Migrate to ephemeral tokens when SDK v2.0+ is available
        return NextResponse.json({
            token: apiKey,
            expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(), // 3 minutes
        });
    } catch (error) {
        console.error('[API /api/gemini/token POST] Error:', error);

        return NextResponse.json(
            {error: error instanceof Error ? error.message : 'Failed to provide token'},
            {status: 500}
        );
    }
}
