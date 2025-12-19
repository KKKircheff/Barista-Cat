import {useState, useRef} from 'react';
import type {ParsedServerMessage, TokenUsage} from '@/lib/types';

interface UseGeminiSessionOptions {
    onMessage?: (message: ParsedServerMessage) => void;
    onError?: (error: Error) => void;
    systemInstruction?: string;
}

interface UseGeminiSessionReturn {
    isConnected: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
    sendAudio: (base64Audio: string) => void;
    error: string | null;
    tokenUsage: TokenUsage | null;
}

/**
 * Custom hook for managing Gemini Live API session via HTTP streaming proxy.
 *
 * Security: API key stays server-side, client communicates via HTTP endpoints.
 * Uses Server-Sent Events (SSE) for receiving responses from Gemini.
 *
 * @param options - Callbacks and configuration for the session
 * @returns Session controls, connection status, and error state
 */
export function useGeminiSession(options?: UseGeminiSessionOptions): UseGeminiSessionReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);

    const sessionIdRef = useRef<string | null>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    const connect = async (): Promise<void> => {
        setError(null);

        try {
            // 1. Create session on server (API key stays server-side)
            const response = await fetch('/api/gemini/session', {method: 'POST'});

            if (!response.ok) {
                throw new Error(`Failed to create session: ${response.statusText}`);
            }

            const {sessionId} = await response.json();
            sessionIdRef.current = sessionId;

            console.log(`[useGeminiSession] Session created: ${sessionId}`);

            // 2. Establish Server-Sent Events stream for responses
            const eventSource = new EventSource(`/api/gemini/stream?sessionId=${sessionId}`);

            eventSource.onmessage = (event) => {
                try {
                    const parsed = JSON.parse(event.data) as ParsedServerMessage;

                    // Skip connection messages
                    if ('type' in parsed && parsed.type === 'connected') {
                        console.log('[useGeminiSession] Stream connected');
                        return;
                    }

                    // Skip timeout messages
                    if ('type' in parsed && parsed.type === 'timeout') {
                        console.log('[useGeminiSession] Stream timeout, will reconnect');
                        return;
                    }

                    // Update cumulative token usage if available
                    if (parsed.usageMetadata) {
                        setTokenUsage((prev) => {
                            if (!prev) return parsed.usageMetadata!;

                            return {
                                promptTokenCount:
                                    (prev.promptTokenCount || 0) + (parsed.usageMetadata!.promptTokenCount || 0),
                                candidatesTokenCount:
                                    (prev.candidatesTokenCount || 0) +
                                    (parsed.usageMetadata!.candidatesTokenCount || 0),
                                totalTokenCount:
                                    (prev.totalTokenCount || 0) + (parsed.usageMetadata!.totalTokenCount || 0),
                            };
                        });
                    }

                    // Call user-provided onMessage callback
                    if (options?.onMessage) {
                        options.onMessage(parsed);
                    }
                } catch (err) {
                    console.error('[useGeminiSession] Parse error:', err);
                }
            };

            eventSource.onerror = (err) => {
                const errorMessage = 'Stream connection error';
                console.error('[useGeminiSession] SSE error:', err);
                setError(errorMessage);

                if (options?.onError) {
                    options.onError(new Error(errorMessage));
                }

                // Don't set isConnected to false on error - stream may reconnect
            };

            eventSourceRef.current = eventSource;
            setIsConnected(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to connect';
            console.error('[useGeminiSession] Connect error:', err);
            setError(message);
            setIsConnected(false);

            if (options?.onError) {
                options.onError(err instanceof Error ? err : new Error(message));
            }

            throw err;
        }
    };

    const disconnect = (): void => {
        // Close SSE stream
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        // Close server-side session
        if (sessionIdRef.current) {
            fetch(`/api/gemini/session?sessionId=${sessionIdRef.current}`, {
                method: 'DELETE',
            }).catch((err) => {
                console.error('[useGeminiSession] Error closing session:', err);
            });

            sessionIdRef.current = null;
        }

        setIsConnected(false);
        setError(null);
        setTokenUsage(null);

        console.log('[useGeminiSession] Disconnected');
    };

    const sendAudio = (base64Audio: string): void => {
        if (!sessionIdRef.current) {
            console.warn('[useGeminiSession] Cannot send audio: not connected');
            return;
        }

        // Send audio chunk to server via HTTP POST
        fetch('/api/gemini/audio', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                sessionId: sessionIdRef.current,
                audioData: base64Audio,
            }),
        })
        .then((response) => {
            if (!response.ok) {
                // Log error but don't fail - audio is continuous stream
                console.warn(`[useGeminiSession] Audio send failed: ${response.status} ${response.statusText}`);
            }
        })
        .catch((err) => {
            console.error('[useGeminiSession] Failed to send audio:', err);
            setError(err instanceof Error ? err.message : 'Failed to send audio');
        });
    };

    return {
        isConnected,
        connect,
        disconnect,
        sendAudio,
        error,
        tokenUsage,
    };
}
