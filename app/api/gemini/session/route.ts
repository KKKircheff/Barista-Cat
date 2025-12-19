import {NextRequest, NextResponse} from 'next/server';
import {sessionManager} from '@/lib/gemini-server';
import {loadDocumentContext} from '@/lib/system-instruction/format';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        // Load system instruction from context data
        const systemInstruction = await loadDocumentContext();

        // Create session on server (API key never exposed to client)
        const sessionId = await sessionManager.createSession(systemInstruction);

        return NextResponse.json({sessionId});
    } catch (error) {
        console.error('[API /api/gemini/session POST] Error:', error);

        return NextResponse.json(
            {error: error instanceof Error ? error.message : 'Failed to create session'},
            {status: 500}
        );
    }
}

export async function DELETE(request: NextRequest) {
    const {searchParams} = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json({error: 'Session ID required'}, {status: 400});
    }

    try {
        sessionManager.closeSession(sessionId);
        return NextResponse.json({success: true});
    } catch (error) {
        console.error('[API /api/gemini/session DELETE] Error:', error);

        return NextResponse.json(
            {error: error instanceof Error ? error.message : 'Failed to close session'},
            {status: 500}
        );
    }
}
