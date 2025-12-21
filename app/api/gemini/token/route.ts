import {GoogleGenAI} from '@google/genai';
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
        const expireTimeISO = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const newSessionExpireISO = new Date(Date.now() + 60 * 1000).toISOString();

        // Create ephemeral token with FULL configuration
        const tokenResponse = await client.authTokens.create({
            config: {
                uses: 1,
                expireTime: expireTimeISO,
                newSessionExpireTime: newSessionExpireISO,
                liveConnectConstraints: {
                    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                    config: {
                        systemInstruction: {
                            parts: [{text: getSystemInstructionWithContext()}],
                        },
                        responseModalities: ['AUDIO'] as any,
                        realtimeInputConfig: {
                            automaticActivityDetection: {
                                disabled: false,
                                startOfSpeechSensitivity: 'START_SENSITIVITY_LOW' as any,
                                // prefixPaddingMs: 100,
                                silenceDurationMs: 200,
                            },
                        },
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: {
                                    voiceName: 'Iapetus',
                                },
                            },
                        },
                        thinkingConfig: {
                            includeThoughts: false,
                            thinkingBudget: 0,
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
                                            'Hide the cocktails menu from view. Call this when user is done looking at the menu, user ordered a drink or conversation moves on.',
                                    },
                                    {
                                        name: 'close_session',
                                        description:
                                            "CRITICAL: ONLY call this when user explicitly wants to LEAVE the café or END their visit. Valid triggers: 'goodbye', 'bye', 'see you', 'gotta go', 'I'm leaving', 'time to go'. DO NOT call when user finishes ordering or says 'I'm done ordering' - they may want more drinks. After orders, ask if they want more or are ready to leave.",
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
            expiresAt: expireTimeISO,
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
