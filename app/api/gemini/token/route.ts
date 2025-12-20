import {GoogleGenAI, Modality} from '@google/genai';
import {NextRequest, NextResponse} from 'next/server';
import {getSystemInstructionWithContext} from '@/lib/system-instruction/format';

export const runtime = 'nodejs';

export async function POST(_request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({error: 'GEMINI_API_KEY not configured'}, {status: 500});
        }

        // Initialize GoogleGenAI client with server-side API key
        const client = new GoogleGenAI({
            apiKey: apiKey,
        });

        // Calculate expiration times
        const expireTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        const newSessionExpireTime = new Date(Date.now() + 60 * 1000); // 1 minute

        // Create ephemeral token with FULL configuration
        const tokenResponse = await client.authTokens.create({
            config: {
                uses: 1, // Secure: One session per token
                liveConnectConstraints: {
                    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                    config: {
                        systemInstruction: {
                            parts: [{text: getSystemInstructionWithContext()}],
                        },
                        responseModalities: [Modality.AUDIO],
                        realtimeInputConfig: {
                            automaticActivityDetection: {
                                disabled: false,
                                startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH' as any,
                                prefixPaddingMs: 100,
                            },
                        },
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: {
                                    voiceName: 'Iapetus',
                                },
                            },
                        },
                        tools: [
                            {
                                functionDeclarations: [
                                    {
                                        name: 'show_menu',
                                        description:
                                            'Show the cocktails and drinks menu to the user. Call this when user asks about drinks, menu, cocktails, or what beverages are available.',
                                    },
                                    {
                                        name: 'hide_menu',
                                        description:
                                            'Hide the cocktails menu from view. Call this when user is done looking at the menu or conversation moves on.',
                                    },
                                    {
                                        name: 'close_session',
                                        description:
                                            "REQUIRED: Call this function immediately when the user says goodbye, bye, see you later, I'm done, or wants to leave. You MUST call this function before saying your farewell message. Do not just say goodbye - actually call this function.",
                                    },
                                ],
                            },
                        ],
                    },
                },
                httpOptions: {apiVersion: 'v1alpha'}, // REQUIRED for ephemeral tokens
            },
        });
        // Return ephemeral token (not raw API key)
        return NextResponse.json({
            token: tokenResponse.name,
            expiresAt: expireTime.toISOString(),
        });
    } catch (error) {
        console.error('[API /api/gemini/token POST] Error creating ephemeral token:', error);

        if (error instanceof Error) {
            // Rate limit errors
            if (error.message.includes('quota') || error.message.includes('rate limit')) {
                return NextResponse.json({error: 'Rate limit exceeded. Please try again later.'}, {status: 429});
            }

            // Authentication errors
            if (error.message.includes('API key') || error.message.includes('authentication')) {
                return NextResponse.json({error: 'Invalid API key configuration'}, {status: 401});
            }
        }

        return NextResponse.json(
            {error: error instanceof Error ? error.message : 'Failed to create ephemeral token'},
            {status: 500}
        );
    }
}
