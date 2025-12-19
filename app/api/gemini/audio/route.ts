import {NextRequest, NextResponse} from 'next/server';
import {sessionManager} from '@/lib/gemini-server';

// Use Node.js runtime
export const runtime = 'nodejs';

/**
 * POST /api/gemini/audio
 * Upload audio chunks to an active Gemini session
 *
 * Body: { sessionId: string, audioData: string (base64) }
 */
export async function POST(request: NextRequest) {
    try {
        const {sessionId, audioData} = await request.json();

        if (!sessionId || !audioData) {
            return NextResponse.json({error: 'Session ID and audio data required'}, {status: 400});
        }

        // Send audio to server-side Gemini WebSocket
        sessionManager.sendAudio(sessionId, audioData);

        return NextResponse.json({success: true});
    } catch (error) {
        console.error('[API /api/gemini/audio POST] Error:', error);

        return NextResponse.json(
            {error: error instanceof Error ? error.message : 'Failed to send audio'},
            {status: 500}
        );
    }
}
