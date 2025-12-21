import {useState, useRef, useCallback} from 'react';
import {GoogleGenAI} from '@google/genai';
import type {LiveServerMessage} from '@google/genai';
import {GEMINI_MODELS, parseLiveServerMessage} from '@/lib/gemini-utils';
import type {ParsedServerMessage, TokenUsage} from '@/lib/types';

interface UseGeminiSessionOptions {
    onMessage?: (message: ParsedServerMessage) => void;
    onFunctionCall?: (functionName: string, args?: any) => void;
    onError?: (error: Error) => void;
}

interface UseGeminiSessionReturn {
    isConnected: boolean;
    connect: (skipGreeting?: boolean) => Promise<void>;
    disconnect: () => void;
    sendAudio: (base64Audio: string) => void;
    sendGreeting: () => void;
    error: string | null;
    tokenUsage: TokenUsage | null;
}

export function useGeminiSession(options?: UseGeminiSessionOptions): UseGeminiSessionReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);

    const sessionRef = useRef<any | null>(null);

    const handleMessage = useCallback(
        (message: LiveServerMessage) => {
            const parsed = parseLiveServerMessage(message);

            if (parsed.usageMetadata) {
                setTokenUsage((prev) => {
                    if (!prev) return parsed.usageMetadata!;

                    return {
                        promptTokenCount: (prev.promptTokenCount || 0) + (parsed.usageMetadata!.promptTokenCount || 0),
                        candidatesTokenCount:
                            (prev.candidatesTokenCount || 0) + (parsed.usageMetadata!.candidatesTokenCount || 0),
                        totalTokenCount: (prev.totalTokenCount || 0) + (parsed.usageMetadata!.totalTokenCount || 0),
                    };
                });
            }

            if (parsed.functionCall) {
                handleFunctionCall(parsed.functionCall);
            }

            if (options?.onMessage) {
                options.onMessage(parsed);
            }
        },
        [options]
    );

    const handleFunctionCall = useCallback(
        (functionCall: {id: string; name: string; args?: any}) => {
            // Notify parent component
            if (options?.onFunctionCall) {
                options.onFunctionCall(functionCall.name, functionCall.args);
            }

            // Send function response with matching ID (CRITICAL!)
            if (sessionRef.current) {
                sessionRef.current.sendToolResponse({
                    functionResponses: [
                        {
                            id: functionCall.id, // MUST include ID to match the call
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

    const connect = async (skipGreeting: boolean = false): Promise<void> => {
        setError(null);

        try {
            // Step 1: Get ephemeral token from backend
            const tokenResponse = await fetch('/api/gemini/token', {method: 'POST'});

            if (!tokenResponse.ok) {
                throw new Error(`Failed to get API key: ${tokenResponse.statusText}`);
            }

            const {token} = await tokenResponse.json();

            // Step 2: Initialize SDK with ephemeral token
            const ai = new GoogleGenAI({
                apiKey: token,
                httpOptions: {
                    apiVersion: 'v1alpha',
                },
            });

            console.log('[useGeminiSession] Connecting to Gemini Live with ephemeral token...');

            // Step 3: Connect with MINIMAL config (everything is in the token)
            const session = await ai.live.connect({
                model: GEMINI_MODELS.LIVE_FLASH_NATIVE,
                callbacks: {
                    onopen: () => {
                        console.log('[useGeminiSession] Connected');
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
                        console.error('[useGeminiSession] WebSocket closed:', {
                            code: event.code,
                            reason: event.reason,
                            wasClean: event.wasClean,
                        });
                        setIsConnected(false);
                    },
                },
            });

            sessionRef.current = session;

            // Send initial greeting trigger (text-based with turnComplete)
            // This forces the model to respond immediately without waiting for user input
            if (!skipGreeting) {
                session.sendClientContent({
                    turns: [
                        {
                            role: 'user',
                            parts: [
                                {
                                    text: 'When a customer first arrives (conversation starts with empty input), greet them with a short, sarcastic remark and immediately ask for their name. Keep greeting + name request under 30 words total (e.g., "Welcome to the Last Purr-over. What\'s your name, stranger?"). Don\'t keep to example be creative',
                                },
                            ],
                        },
                    ],
                    turnComplete: true,
                });
            }
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

    const sendGreeting = (): void => {
        if (!sessionRef.current) {
            return;
        }

        // Trigger bartender greeting with empty text + turnComplete
        sessionRef.current.sendClientContent({
            turns: [{role: 'user', parts: [{text: ''}]}],
            turnComplete: true,
        });
    };

    return {
        isConnected,
        connect,
        disconnect,
        sendAudio,
        sendGreeting,
        error,
        tokenUsage,
    };
}
