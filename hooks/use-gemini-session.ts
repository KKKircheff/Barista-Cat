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
                handleFunctionCall(parsed.functionCall);  // Pass entire object with id
            }

            // Call user-provided onMessage callback
            if (options?.onMessage) {
                options.onMessage(parsed);
            }
        },
        [options]
    );

    const handleFunctionCall = useCallback(
        (functionCall: {id: string, name: string, args?: any}) => {
            // Notify parent component
            if (options?.onFunctionCall) {
                options.onFunctionCall(functionCall.name, functionCall.args);
            }

            // Send function response with matching ID (CRITICAL!)
            if (sessionRef.current) {
                sessionRef.current.sendToolResponse({
                    functionResponses: [
                        {
                            id: functionCall.id,  // MUST include ID to match the call
                            name: functionCall.name,
                            response: {
                                success: true,
                                message: `Function ${functionCall.name} executed`,
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
            const tokenResponse = await fetch('/api/gemini/token', {method: 'POST'});

            if (!tokenResponse.ok) {
                throw new Error(`Failed to get API key: ${tokenResponse.statusText}`);
            }

            const {token} = await tokenResponse.json();

            // Step 2: Initialize SDK with API key
            const ai = new GoogleGenAI({apiKey: token});

            // Step 3: Connect to Gemini Live WebSocket directly
            const session = await ai.live.connect({
                model: GEMINI_MODELS.LIVE_FLASH_NATIVE,
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: {
                        parts: [{
                            text: 'You are "Whiskerjack", a post-apocalyptic barista cat. Be sarcastic but charming. Keep responses under 20 words. When conversation starts with empty input, greet with max 10 words like: "What\'s it gonna be?" or "Yeah, we\'re open. Barely."\n\nIMPORTANT: You have access to tools (show_menu, hide_menu, close_session). You MUST use these tools when appropriate. When the user says goodbye or wants to leave, call the close_session function immediately before saying farewell.'
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
                                description: 'REQUIRED: Call this function immediately when the user says goodbye, bye, see you later, I\'m done, or wants to leave. You MUST call this function before saying your farewell message. Do not just say goodbye - actually call this function.'
                            }
                        ]
                    }]
                },
                callbacks: {
                    onopen: () => {
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
    };

    const sendAudio = (base64Audio: string): void => {
        if (!sessionRef.current) {
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
