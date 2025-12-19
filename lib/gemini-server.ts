/**
 * Server-Side Gemini Session Manager
 *
 * Manages WebSocket connections to Gemini Live API on the server side,
 * keeping the GEMINI_API_KEY secure and never exposing it to clients.
 *
 * Security: API key loaded from process.env server-side only
 * Sessions: Stored in-memory with automatic 3-minute timeout cleanup
 */

import {GoogleGenAI, Modality} from '@google/genai';
import type {LiveSession, ServerMessage} from './types';
import {GEMINI_MODELS} from './gemini';

interface SessionData {
    connection: LiveSession;
    lastActivity: number;
    messageQueue: ServerMessage[];
    isReady: boolean; // Track if WebSocket connection is fully established
}

class GeminiSessionManager {
    private sessions = new Map<string, SessionData>();

    /**
     * Create a new Gemini Live API session
     * @param systemInstruction - System instruction for the AI
     * @returns Session ID (UUID) for client to reference
     */
    async createSession(systemInstruction: string): Promise<string> {
        const sessionId = crypto.randomUUID();
        console.log(`[GeminiServer] Creating session ${sessionId}...`);

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('GEMINI_API_KEY not configured in environment variables');
        }

        const ai = new GoogleGenAI({apiKey});

        // Promise to track when WebSocket connection is ready
        let resolveReady!: () => void;
        let rejectReady!: (error: Error) => void;
        const readyPromise = new Promise<void>((resolve, reject) => {
            resolveReady = resolve;
            rejectReady = reject;
        });

        // Timeout if connection takes too long (5 seconds)
        const timeoutId = setTimeout(() => {
            console.error(`[GeminiServer] Session ${sessionId} timeout - WebSocket didn't connect in 5 seconds`);
            rejectReady(new Error('WebSocket connection timeout after 5 seconds'));
        }, 5000);

        try {
            console.log(`[GeminiServer] Calling ai.live.connect() for session ${sessionId}...`);

            // Store session entry BEFORE ai.live.connect() to prevent race condition
            // The connection will be populated after ai.live.connect() completes
            this.sessions.set(sessionId, {
                connection: null as any, // Placeholder - will be set after connect
                lastActivity: Date.now(),
                messageQueue: [],
                isReady: false,
            });
            console.log(`[GeminiServer] Session ${sessionId} placeholder created before connect`);

            const session = await ai.live.connect({
                model: GEMINI_MODELS.LIVE_FLASH_NATIVE,
                config: {
                    responseModalities: ['AUDIO'] as Modality[],
                    systemInstruction,
                },
                callbacks: {
                    onopen: () => {
                        clearTimeout(timeoutId);
                        console.log(`[GeminiServer] Session ${sessionId} WebSocket connected`);
                        // Mark session as ready and resolve the promise
                        const sessionData = this.sessions.get(sessionId);
                        if (sessionData) {
                            sessionData.isReady = true;
                            console.log(`[GeminiServer] Session ${sessionId} ready for audio streaming (onopen fired)`);
                            resolveReady();
                        } else {
                            rejectReady(new Error('Session data not found during onopen'));
                        }
                    },
                    onmessage: (msg) => this.handleMessage(sessionId, msg),
                    onerror: (event: any) => {
                        clearTimeout(timeoutId);
                        console.error(`[GeminiServer] Session ${sessionId} WebSocket error:`, {
                            message: event.message || 'Unknown error',
                            type: event.type,
                            timestamp: new Date().toISOString()
                        });
                        rejectReady(new Error(event.message || 'WebSocket error'));
                    },
                    onclose: (event: any) => {
                        console.log(`[GeminiServer] Session ${sessionId} WebSocket closed:`, {
                            code: event.code,
                            reason: event.reason || 'No reason provided',
                            wasClean: event.wasClean
                        });
                        this.sessions.delete(sessionId);
                    },
                },
            });

            console.log(`[GeminiServer] ai.live.connect() completed for session ${sessionId}`);

            // Update the session connection reference (session was already stored before connect)
            const sessionData = this.sessions.get(sessionId);
            if (!sessionData) {
                // This should never happen - means session was deleted during connect
                throw new Error('Session entry disappeared during connection establishment');
            }
            sessionData.connection = session as LiveSession;

            const connectionTime = Date.now() - sessionData.lastActivity;
            console.log(`[GeminiServer] Session ${sessionId} WebSocket connected in ${connectionTime}ms`);
            console.log(`[GeminiServer] Session ${sessionId} connection established, waiting for WebSocket onopen...`);

            // Wait for WebSocket to be fully connected before returning
            await readyPromise;
            console.log(`[GeminiServer] Session ${sessionId} ready for audio streaming`);

            return sessionId;
        } catch (error) {
            clearTimeout(timeoutId);
            console.error(`[GeminiServer] Failed to create session ${sessionId}:`, error);
            // Clean up on failure
            this.sessions.delete(sessionId);
            throw error;
        }
    }

    /**
     * Send audio chunk to Gemini for a specific session
     * @param sessionId - Session ID
     * @param audioData - Base64-encoded PCM audio data
     */
    sendAudio(sessionId: string, audioData: string): void {
        const session = this.sessions.get(sessionId);

        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }

        if (!session.isReady) {
            throw new Error(`Session ${sessionId} not ready yet. WebSocket connection still establishing.`);
        }

        session.connection.sendRealtimeInput({
            audio: {
                data: audioData,
                mimeType: 'audio/pcm;rate=16000',
            },
        });

        session.lastActivity = Date.now();
    }

    /**
     * Get all queued messages for a session (and clear the queue)
     * @param sessionId - Session ID
     * @returns Array of server messages
     */
    getMessages(sessionId: string): ServerMessage[] {
        const session = this.sessions.get(sessionId);

        if (!session) {
            return [];
        }

        session.lastActivity = Date.now();
        return session.messageQueue.splice(0); // Remove and return all messages
    }

    /**
     * Close a session and cleanup resources
     * @param sessionId - Session ID
     */
    closeSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);

        if (session) {
            try {
                session.connection.close();
            } catch (error) {
                console.error(`[GeminiServer] Error closing session ${sessionId}:`, error);
            }

            this.sessions.delete(sessionId);
            console.log(`[GeminiServer] Session ${sessionId} closed and removed`);
        }
    }

    /**
     * Handle incoming message from Gemini WebSocket
     * @private
     */
    private handleMessage(sessionId: string, message: any): void {
        const session = this.sessions.get(sessionId);

        if (session) {
            session.messageQueue.push(message as ServerMessage);
            session.lastActivity = Date.now();
        }
    }

    /**
     * Cleanup stale sessions (called by interval timer)
     * @private
     */
    private cleanupStaleSessions(): void {
        const now = Date.now();
        const timeout = 3 * 60 * 1000; // 3 minutes

        for (const [sessionId, session] of this.sessions) {
            if (now - session.lastActivity > timeout) {
                console.log(`[GeminiServer] Cleaning up stale session ${sessionId}`);
                this.closeSession(sessionId);
            }
        }
    }

    /**
     * Get session statistics (for monitoring)
     */
    getStats(): {activeSessions: number; totalMessages: number} {
        let totalMessages = 0;

        for (const session of this.sessions.values()) {
            totalMessages += session.messageQueue.length;
        }

        return {
            activeSessions: this.sessions.size,
            totalMessages,
        };
    }
}

// Export singleton instance
export const sessionManager = new GeminiSessionManager();

// Setup cleanup interval (runs every 30 seconds)
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        sessionManager['cleanupStaleSessions']();
    }, 30000);
}
