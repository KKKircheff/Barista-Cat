import {GoogleGenAI, Modality} from '@google/genai';
import type {LiveServerMessage} from '@google/genai';
import type {SessionConfig} from './types';

export const GEMINI_MODELS = {
    LIVE_FLASH_NATIVE: 'gemini-2.5-flash-native-audio-preview-12-2025',
} as const;

export async function connectany(
    apiKey: string,
    systemInstruction: string,
    callbacks: {
        onOpen?: () => void;
        onMessage?: (message: LiveServerMessage) => void;
        onError?: (error: Error) => void;
        onClose?: (reason: string) => void;
    }
): Promise<any> {
    if (!apiKey) {
        throw new Error('API key is required. Please set GEMINI_API_KEY in .env.local');
    }

    try {
        const ai = new GoogleGenAI({apiKey});

        const config: SessionConfig = {
            model: GEMINI_MODELS.LIVE_FLASH_NATIVE,
            systemInstruction,
            responseModalities: ['AUDIO'] as const,
        };

        const session = await ai.live.connect({
            model: config.model,
            config: {
                responseModalities: config.responseModalities as Modality[],
                systemInstruction: config.systemInstruction,
            },
            callbacks: {
                onopen: () => {
                    console.log('[Gemini] Connected');
                    callbacks.onOpen?.();
                },
                onmessage: (message: any) => {
                    callbacks.onMessage?.(message as LiveServerMessage);
                },
                onerror: (event: any) => {
                    console.error('[Gemini] Error:', event.message || 'Connection error');
                    const error = new Error(event.message || 'WebSocket error occurred');
                    callbacks.onError?.(error);
                },
                onclose: (event: any) => {
                    console.log('[Gemini] Disconnected');
                    callbacks.onClose?.(event.reason || 'Connection closed');
                },
            },
        });

        return session as any;
    } catch (error) {
        console.error('[Gemini] Failed to connect:', error);
        throw new Error(
            `Failed to connect to Gemini Live API: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

export function sendAudioChunk(session: any, base64Audio: string): void {
    try {
        session.sendRealtimeInput({
            audio: {
                data: base64Audio,
                mimeType: 'audio/pcm;rate=16000',
            },
        });
    } catch (error) {
        console.error('[Gemini] Send error:', error);
        throw error;
    }
}

export function parseLiveServerMessage(message: any): {
    text?: string;
    audioData?: string;
    turnComplete: boolean;
    usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
    };
    functionCall?: {
        id: string;
        name: 'show_menu' | 'hide_menu' | 'close_session';
        args?: any;
    };
} {
    const result = {
        text: undefined as string | undefined,
        audioData: undefined as string | undefined,
        turnComplete: false,
        usageMetadata: undefined as any,
        functionCall: undefined as any,
    };

    if (message.setupComplete) {
        return result;
    }

    if (message.serverContent?.turnComplete) {
        result.turnComplete = true;
    }

    if (message.toolCall?.functionCalls) {
        for (const funcCall of message.toolCall.functionCalls) {
            if (['show_menu', 'hide_menu', 'close_session'].includes(funcCall.name)) {
                result.functionCall = {
                    id: funcCall.id,
                    name: funcCall.name,
                    args: funcCall.args,
                };
                break; // Only process first function call
            }
        }
    }

    if (!result.functionCall && message.serverContent?.modelTurn?.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
            if (part.functionCall && ['show_menu', 'hide_menu', 'close_session'].includes(part.functionCall.name)) {
                result.functionCall = {
                    id: part.functionCall.id,
                    name: part.functionCall.name,
                    args: part.functionCall.args,
                };
                break;
            }
        }
    }

    if (message.text) {
        result.text = message.text;
    } else if (message.serverContent?.modelTurn?.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
            if (part.text) {
                result.text = part.text;
                break;
            }
        }
    }

    if (message.data) {
        result.audioData = message.data;
    } else if (message.serverContent?.modelTurn?.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
            if (part.inlineData?.data) {
                result.audioData = part.inlineData.data;
                break;
            }
        }
    }

    if (message.usageMetadata) {
        result.usageMetadata = {
            promptTokenCount: message.usageMetadata.promptTokenCount,
            candidatesTokenCount: message.usageMetadata.candidatesTokenCount,
            totalTokenCount: message.usageMetadata.totalTokenCount,
        };
    } else if (message.serverContent?.usageMetadata) {
        result.usageMetadata = {
            promptTokenCount: message.serverContent.usageMetadata.promptTokenCount,
            candidatesTokenCount: message.serverContent.usageMetadata.candidatesTokenCount,
            totalTokenCount: message.serverContent.usageMetadata.totalTokenCount,
        };
    }

    return result;
}

export function closeSession(session: any): void {
    try {
        session.close();
    } catch (error) {
        console.error('[Gemini] Close error:', error);
    }
}
