import {useState, useRef, useCallback} from 'react';
import {GoogleGenAI, Modality} from '@google/genai';
import type {LiveServerMessage} from '@google/genai';
import {GEMINI_MODELS} from '@/lib/gemini';
import {parseLiveServerMessage} from '@/lib/gemini';
import type {ParsedServerMessage, TokenUsage} from '@/lib/types';

interface UseGeminiSessionOptions {
    onMessage?: (message: ParsedServerMessage) => void;
    onFunctionCall?: (functionName: string, args?: any) => void;
    onError?: (error: Error) => void;
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
 * Custom hook for managing Gemini Live API session via direct WebSocket.
 *
 * Security: API key is fetched from backend endpoint and used for direct connection.
 * Uses direct WebSocket connection to Gemini Live API for minimal latency.
 *
 * @param options - Callbacks and configuration for the session
 * @returns Session controls, connection status, and error state
 */
export function useGeminiSession(options?: UseGeminiSessionOptions): UseGeminiSessionReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);

    const sessionRef = useRef<any | null>(null);

    const handleMessage = useCallback(
        (message: LiveServerMessage) => {
            // Parse message using existing utility
            const parsed = parseLiveServerMessage(message);

            // Update token usage (cumulative)
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

            // Handle function calls
            if (parsed.functionCall) {
                handleFunctionCall(parsed.functionCall.name, parsed.functionCall.args);
            }

            // Call user-provided onMessage callback
            if (options?.onMessage) {
                options.onMessage(parsed);
            }
        },
        [options]
    );

    const handleFunctionCall = useCallback(
        (functionName: string, args?: any) => {
            console.log('[useGeminiSession] Function call:', functionName, args);

            // Notify parent component
            if (options?.onFunctionCall) {
                options.onFunctionCall(functionName, args);
            }

            // Send function response back to Gemini
            if (sessionRef.current) {
                sessionRef.current.sendToolResponse({
                    functionResponses: [
                        {
                            name: functionName,
                            response: {
                                success: true,
                                message: `Function ${functionName} executed`,
                            },
                        },
                    ],
                });
            }
        },
        [options]
    );

    const connect = async (): Promise<void> => {
        setError(null);

        try {
            // Step 1: Get API key from backend
            console.log('[useGeminiSession] Requesting API key...');
            const tokenResponse = await fetch('/api/gemini/token', {method: 'POST'});

            if (!tokenResponse.ok) {
                throw new Error(`Failed to get API key: ${tokenResponse.statusText}`);
            }

            const {token} = await tokenResponse.json();
            console.log('[useGeminiSession] API key received');

            // Step 2: Initialize SDK with API key
            const ai = new GoogleGenAI({apiKey: token});

            // Step 3: Connect to Gemini Live WebSocket directly
            console.log('[useGeminiSession] Connecting to Gemini Live API...');
            const session = await ai.live.connect({
                model: GEMINI_MODELS.LIVE_FLASH_NATIVE,
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: {
                        parts: [{
                            text: 'You are "Whiskerjack", a post-apocalyptic barista cat. Be sarcastic but charming. Keep responses under 20 words. When conversation starts with empty input, greet with max 10 words like: "What\'s it gonna be?" or "Yeah, we\'re open. Barely."'
                        }]
                    },
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: 'Iapetus'
                            }
                        }
                    },
                    tools: [{
                        functionDeclarations: [
                            {
                                name: 'show_menu',
                                description: 'Show the cocktails and drinks menu to the user. Call this when user asks about drinks, menu, cocktails, or what beverages are available.'
                            },
                            {
                                name: 'hide_menu',
                                description: 'Hide the cocktails menu from view. Call this when user is done looking at the menu or conversation moves on.'
                            },
                            {
                                name: 'close_session',
                                description: 'End the conversation and close the session. Call this when the barista says goodbye or the customer is leaving.'
                            }
                        ]
                    }]
                },
                callbacks: {
                    onopen: () => {
                        console.log('[useGeminiSession] WebSocket connected');
                        setIsConnected(true);
                    },
                    onmessage: (msg: LiveServerMessage) => {
                        handleMessage(msg);
                    },
                    onerror: (event: any) => {
                        const errorMsg = event.message || 'WebSocket error';
                        console.error('[useGeminiSession] WebSocket error:', event);
                        setError(errorMsg);

                        if (options?.onError) {
                            options.onError(new Error(errorMsg));
                        }
                    },
                    onclose: (event: any) => {
                        console.log(
                            '[useGeminiSession] WebSocket closed:',
                            event.reason || 'Connection closed'
                        );
                        setIsConnected(false);
                    },
                },
            });

            sessionRef.current = session;

            // Send initial greeting trigger (empty message) after session is established
            session.sendClientContent({
                turns: [
                    {
                        role: 'user',
                        parts: [{text: ''}],
                    },
                ],
            });
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
        if (sessionRef.current) {
            sessionRef.current.close();
            sessionRef.current = null;
        }

        setIsConnected(false);
        setError(null);
        setTokenUsage(null);

        console.log('[useGeminiSession] Disconnected');
    };

    const sendAudio = (base64Audio: string): void => {
        if (!sessionRef.current) {
            console.warn('[useGeminiSession] Cannot send audio: not connected');
            return;
        }

        sessionRef.current.sendRealtimeInput({
            audio: {
                data: base64Audio,
                mimeType: 'audio/pcm;rate=16000',
            },
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
