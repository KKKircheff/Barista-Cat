import {GoogleGenAI, Modality} from '@google/genai';
import type {LiveServerMessage} from '@google/genai';
import type {SessionConfig} from './types';

// Model names
export const GEMINI_MODELS = {
    LIVE_FLASH: 'gemini-live-2.5-flash-preview',
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

/**
 * Parse server message and extract relevant data
 *
 * Note: The Gemini SDK may log warnings about "non-text parts inlineData"
 * or "non-data parts text,thought" when responses contain mixed content types
 * (text + audio + thought). These are informational and expected when using
 * AUDIO response modality. The warnings are suppressed in VoiceChat.tsx.
 */
export function parseLiveServerMessage(message: any): {    text?: string;    audioData?: string;    turnComplete: boolean;    usageMetadata?: {        promptTokenCount?: number;        candidatesTokenCount?: number;        totalTokenCount?: number;    };    functionCall?: {        name: 'show_menu' | 'hide_menu' | 'close_session';        args?: any;    };} {    const result = {        text: undefined as string | undefined,        audioData: undefined as string | undefined,        turnComplete: false,        usageMetadata: undefined as any,        functionCall: undefined as any,    };    // Check for setup complete (initial handshake)    if (message.setupComplete) {        return result;    }    // Check for turn complete    if (message.serverContent?.turnComplete) {        result.turnComplete = true;    }    // Check for function calls in toolCall.functionCalls (primary location)    if (message.toolCall?.functionCalls) {        for (const funcCall of message.toolCall.functionCalls) {            if (['show_menu', 'hide_menu', 'close_session'].includes(funcCall.name)) {                result.functionCall = {                    name: funcCall.name,                    args: funcCall.args,                };                break; // Only process first function call            }        }    }    // Also check for function calls in serverContent.modelTurn.parts (alternative location)    if (!result.functionCall && message.serverContent?.modelTurn?.parts) {        for (const part of message.serverContent.modelTurn.parts) {            if (                part.functionCall &&                ['show_menu', 'hide_menu', 'close_session'].includes(part.functionCall.name)            ) {                result.functionCall = {                    name: part.functionCall.name,                    args: part.functionCall.args,                };                break;            }        }    }

    // Extract text content - try multiple paths
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

    // Extract audio data - try multiple paths
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

    // Extract usage metadata - check multiple paths
    // Note: Gemini Live API may not consistently provide usage metadata
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
