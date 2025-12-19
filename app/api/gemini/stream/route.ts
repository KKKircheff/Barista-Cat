import {NextRequest} from 'next/server';
import {sessionManager} from '@/lib/gemini-server';
import {parseServerMessage} from '@/lib/gemini';

// Use Node.js runtime
export const runtime = 'nodejs';

/**
 * GET /api/gemini/stream?sessionId=xxx
 * Server-Sent Events stream for receiving Gemini responses
 *
 * Establishes a long-lived HTTP connection that streams messages
 * from the server-side Gemini WebSocket to the client.
 */
export async function GET(request: NextRequest) {
    const {searchParams} = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
        return new Response('Session ID required', {status: 400});
    }

    const encoder = new TextEncoder();

    // Create readable stream for SSE
    const stream = new ReadableStream({
        async start(controller) {
            const sendMessage = (data: any) => {
                const message = `data: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(message));
            };

            // Send initial connection message
            sendMessage({type: 'connected', sessionId});

            // Poll for messages every 50ms
            const interval = setInterval(() => {
                try {
                    const messages = sessionManager.getMessages(sessionId);

                    for (const msg of messages) {
                        const parsed = parseServerMessage(msg);
                        sendMessage(parsed);
                    }
                } catch (error) {
                    console.error('[API /api/gemini/stream] Error polling messages:', error);
                    clearInterval(interval);
                    controller.close();
                }
            }, 50);

            // Cleanup after 60 seconds (stream will be re-established if needed)
            const timeout = setTimeout(() => {
                clearInterval(interval);
                sendMessage({type: 'timeout', message: 'Stream timeout, reconnect if needed'});
                controller.close();
            }, 60000);

            // Cleanup on abort
            request.signal.addEventListener('abort', () => {
                clearInterval(interval);
                clearTimeout(timeout);
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
        },
    });
}
