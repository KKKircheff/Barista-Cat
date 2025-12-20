'use client';

import {useEffect, useState} from 'react';
import {useGeminiSession} from '@/hooks/use-gemini-session';
import {useAudioCapture} from '@/hooks/use-audio-capture';
import {useAudioPlayback} from '@/hooks/use-audio-playback';
import {useVolumeLevel} from '@/hooks/use-volume-level';

import {GradientButton} from '@/components/shared/gradient-button';
import {Spinner} from '@/components/ui/spinner';
import {BaristaImage} from './barista-image';
import {VolumeBar} from './volume-bar';
import {ErrorAlert} from './error-alert';
import {MenuCard} from './menu-card';
import {TokenUsageDisplay} from './token-usage-display';

/**
 * Main VoiceChat orchestrator component.
 * Coordinates all custom hooks and child components for the voice chat experience.
 *
 * One-button flow: "Go to bar" → loading → mic auto-starts → ready to talk!
 */
export function VoiceChat() {
    const [showMenu, setShowMenu] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false); // Loading state during connection

    // Custom hooks manage all business logic
    const audioPlayback = useAudioPlayback(24000);
    const audioCapture = useAudioCapture();
    const volumeLevel = useVolumeLevel(audioCapture.analyser, audioCapture.isRecording);

    const geminiSession = useGeminiSession({
        onMessage: (message) => {
            // Handle audio response - play through speakers
            if (message.audioData) {
                audioPlayback.play(message.audioData).catch((err) => {
                    console.error('[VoiceChat] Audio playback error:', err);
                });
            }

            // FALLBACK: Detect goodbye in text if function wasn't called
            if (message.text && message.turnComplete) {
                const text = message.text.toLowerCase();
                const goodbyeKeywords = ['goodbye', 'bye', 'see you', 'session closed', 'take care', 'later'];
                const containsGoodbye = goodbyeKeywords.some(keyword => text.includes(keyword));

                if (containsGoodbye) {
                    setTimeout(() => {
                        handleDisconnect();
                    }, 2000); // Give audio time to finish
                }
            }
        },
        onFunctionCall: (functionName, args) => {
            if (functionName === 'show_menu') {
                setShowMenu(true);
            } else if (functionName === 'hide_menu') {
                setShowMenu(false);
            } else if (functionName === 'close_session') {
                // Close after a short delay to let current audio finish
                setShowMenu(false);
                setTimeout(() => {
                    handleDisconnect();
                }, 2000);
            }
        },
    });

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            audioCapture.stopRecording();
            audioPlayback.stop();
            geminiSession.disconnect();
        };
    }, []);

    // "Go to bar" - creates session and auto-starts mic
    const handleGoToBar = async () => {
        try {
            setIsConnecting(true);

            // Connect to Gemini (triggers greeting)
            await geminiSession.connect();

            // Wait a moment for WebSocket to stabilize
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Auto-start microphone recording
            await audioCapture.startRecording(geminiSession.sendAudio);

            setIsConnecting(false);
        } catch (error) {
            console.error('[VoiceChat] Failed to initialize:', error);
            setIsConnecting(false);
        }
    };

    // Disconnect and cleanup all resources
    const handleDisconnect = () => {
        audioCapture.stopRecording();
        audioPlayback.stop();
        geminiSession.disconnect();
        setShowMenu(false);
        setIsConnecting(false);
    };

    // Combine errors from both session and capture
    const error = geminiSession.error || audioCapture.error;

    return (
        <div className="w-full space-y-6 gap-3">
            {/* Barista image with voice indicator overlay */}
            <BaristaImage showVoiceIndicator={audioPlayback.isPlayingAudio} />

            {/* Menu card - shown when user asks for drinks */}
            {showMenu && <MenuCard onClose={() => setShowMenu(false)} />}

            {/* "Go to bar" button - shown when disconnected */}
            {!geminiSession.isConnected && !audioCapture.isRecording && !isConnecting && (
                <div className="flex justify-center pt-4">
                    <GradientButton variant="purple-pink" onClick={handleGoToBar}>
                        Go to bar
                    </GradientButton>
                </div>
            )}

            {/* Loading state while connecting */}
            {isConnecting && (
                <div className="flex justify-center pt-4">
                    <GradientButton variant="purple-pink" disabled>
                        <Spinner />
                        Entering the bar...
                    </GradientButton>
                </div>
            )}

            {/* "Finish your order" button - shown when recording */}
            {audioCapture.isRecording && (
                <div className="flex justify-center pt-4">
                    <GradientButton variant="ghost" onClick={handleDisconnect}>
                        Finish your order
                    </GradientButton>
                </div>
            )}

            {/* Volume visualization during recording */}
            <VolumeBar level={volumeLevel.volumeLevel} show={audioCapture.isRecording} />

            {/* Error display */}
            <ErrorAlert error={error} />

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
