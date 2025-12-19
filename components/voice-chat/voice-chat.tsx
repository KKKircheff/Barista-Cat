'use client';

import { useEffect, useState } from 'react';
import { useGeminiSession } from '@/hooks/use-gemini-session';
import { useAudioCapture } from '@/hooks/use-audio-capture';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import { useVolumeLevel } from '@/hooks/use-volume-level';

import { GradientButton } from '@/components/shared/gradient-button';
import { BaristaImage } from './barista-image';
import { VolumeBar } from './volume-bar';
import { ErrorAlert } from './error-alert';
import { TranscriptDisplay } from './transcript-display';
import { TokenUsageDisplay } from './token-usage-display';

import type { Message } from '@/lib/types';

/**
 * Main VoiceChat orchestrator component.
 * Coordinates all custom hooks and child components for the voice chat experience.
 *
 * Reduced from 283 lines to ~80 lines through proper separation of concerns.
 */
export function VoiceChat() {
    const [transcript, setTranscript] = useState<Message[]>([]);

    // Custom hooks manage all business logic
    const audioPlayback = useAudioPlayback(24000);
    const audioCapture = useAudioCapture();
    const volumeLevel = useVolumeLevel(audioCapture.analyser, audioCapture.isRecording);

    const geminiSession = useGeminiSession({
        onMessage: (message) => {
            // Handle text response - add to transcript
            if (message.text) {
                setTranscript((prev) => [
                    ...prev,
                    {
                        role: 'model',
                        content: message.text!,
                        timestamp: Date.now(),
                    },
                ]);
            }

            // Handle audio response - play through speakers
            if (message.audioData) {
                audioPlayback.play(message.audioData).catch((err) => {
                    console.error('[VoiceChat] Audio playback error:', err);
                });
            }
        },
    });

    useEffect(() => {
        return () => {
            audioCapture.stopRecording();
            audioPlayback.stop();
            geminiSession.disconnect();
        };
    }, []);

    // Combined connect + auto-start recording handler
    // Uses single user gesture to satisfy browser mic permission requirements
    const handleConnectAndRecord = async () => {
        try {
            // Step 1: Establish Gemini session
            await geminiSession.connect();

            // Step 2: Immediately start recording (within same user gesture)
            await audioCapture.startRecording(geminiSession.sendAudio);

            console.log('[VoiceChat] Connected and recording started');
        } catch (error) {
            console.error('[VoiceChat] Failed to connect and start recording:', error);
            // Error is automatically displayed via ErrorAlert component
        }
    };

    // Disconnect and cleanup all resources
    const handleDisconnect = () => {
        audioCapture.stopRecording();
        audioPlayback.stop();
        geminiSession.disconnect();
        setTranscript([]);
    };

    // Combine errors from both session and capture
    const error = geminiSession.error || audioCapture.error;

    return (
        <div className="w-full space-y-6">
            {/* Barista image - always visible */}
            <BaristaImage />

            {/* "Start your order" button - shown when disconnected */}
            {!geminiSession.isConnected && (
                <div className="flex justify-center">
                    <GradientButton variant="purple-pink" onClick={handleConnectAndRecord}>
                        Start your order
                    </GradientButton>
                </div>
            )}

            {/* "Finish your order" button - shown when connected */}
            {geminiSession.isConnected && (
                <div className="flex justify-center">
                    <GradientButton variant="ghost" onClick={handleDisconnect}>
                        Finish your order
                    </GradientButton>
                </div>
            )}

            {/* Volume visualization during recording */}
            <VolumeBar level={volumeLevel.volumeLevel} show={audioCapture.isRecording} />

            {/* Error display */}
            <ErrorAlert error={error} />

            {/* Conversation transcript */}
            <TranscriptDisplay messages={transcript} />

            {/* Token usage display */}
            <div className="flex justify-center">
                <TokenUsageDisplay
                    usage={geminiSession.tokenUsage}
                    isConnected={geminiSession.isConnected}
                />
            </div>
        </div>
    );
}
