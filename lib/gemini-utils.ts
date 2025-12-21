export const GEMINI_MODELS = {
    LIVE_FLASH_NATIVE: 'gemini-2.5-flash-native-audio-preview-12-2025',
} as const;

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
