'use client';

import { useEffect, useState, useRef } from 'react';
import { useGeminiSession } from '@/hooks/use-gemini-session';
import { useAudioCapture } from '@/hooks/use-audio-capture';
import { useAudioPlayback } from '@/hooks/use-audio-playback';
import { useVolumeLevel } from '@/hooks/use-volume-level';

import { GradientButton } from '@/components/shared/gradient-button';
import { Spinner } from '@/components/ui/spinner';
import { BaristaImage } from './barista-image';
import { VolumeBar } from './volume-bar';
import { ErrorAlert } from './error-alert';
import { MenuCard } from './menu-card';
import { TokenUsageDisplay } from './token-usage-display';

/**
 * Main VoiceChat orchestrator component.
 * Coordinates all custom hooks and child components for the voice chat experience.
 *
 * Auto-connect flow:
 * 1. Page loads → "Preparing session..." (auto-connect WebSocket + AudioContext + mic)
 * 2. Everything initialized → Bartender starts greeting
 * 3. User has time to respond before bartender finishes talking
 */
export function VoiceChat() {
    const [showMenu, setShowMenu] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true); // Start in initializing state
    const [sessionEnded, setSessionEnded] = useState(false); // Track if session has ended
    const [isClosing, setIsClosing] = useState(false); // Track if session is closing
    const hasAutoInitialized = useRef(false); // Track if auto-initialization has run

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
        },
        onFunctionCall: (functionName, args) => {
            console.log('[VoiceChat] Function called:', functionName);
            if (functionName === 'show_menu') {
                setShowMenu(true);
            } else if (functionName === 'hide_menu') {
                setShowMenu(false);
            } else if (functionName === 'close_session') {
                // Mark as closing and hide menu
                console.warn('[VoiceChat] close_session called - this should only happen on goodbye!');
                setIsClosing(true);
                setShowMenu(false);

                // Wait 6 seconds for bartender to finish farewell audio
                setTimeout(() => {
                    handleDisconnect();
                }, 6000);
            }
        },
    });

    // Auto-initialize everything on page load (only runs once)
    useEffect(() => {
        const autoInitialize = async () => {
            // Only run on first mount, not on "Go to bar" clicks
            if (!geminiSession.isConnected && isInitializing && !sessionEnded && !hasAutoInitialized.current) {
                hasAutoInitialized.current = true; // Mark as initialized
                try {
                    console.log('[VoiceChat] Auto-initializing on page load...');
                    const startTime = performance.now();

                    // Step 1: Connect to Gemini (skip greeting for now)
                    await geminiSession.connect(true); // skipGreeting = true
                    console.log('[VoiceChat] ✓ Gemini session connected');

                    // Step 2: Initialize AudioContext
                    await audioPlayback.initialize();
                    console.log('[VoiceChat] ✓ AudioContext initialized');

                    // Step 3: Start microphone recording
                    await audioCapture.startRecording(geminiSession.sendAudio);
                    console.log('[VoiceChat] ✓ Microphone started');

                    // Step 4: Send greeting to trigger bartender
                    geminiSession.sendGreeting();
                    console.log('[VoiceChat] ✓ Greeting sent');

                    const elapsed = performance.now() - startTime;
                    console.log(`[VoiceChat] Full initialization complete in ${elapsed.toFixed(0)}ms`);
                    setIsInitializing(false);
                } catch (error) {
                    console.error('[VoiceChat] Auto-initialize failed:', error);
                    setIsInitializing(false);
                }
            }
        };

        autoInitialize();
    }, [geminiSession.isConnected, isInitializing, sessionEnded]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            audioCapture.stopRecording();
            audioPlayback.stop();
            geminiSession.disconnect();
        };
    }, []);

    // Disconnect and cleanup all resources
    const handleDisconnect = () => {
        audioCapture.stopRecording();
        audioPlayback.stop();
        geminiSession.disconnect();
        setShowMenu(false);
        setIsClosing(false);
        setSessionEnded(true); // Mark session as ended to show "Go to bar" button
    };

    // Start a new session when user clicks "Go to bar" button
    const handleGoToBar = async () => {
        try {
            console.log('[VoiceChat] Starting new session...');
            setSessionEnded(false);
            setIsClosing(false);
            // Don't set isInitializing to avoid triggering the useEffect
            const startTime = performance.now();

            // Step 1: Connect to Gemini (skip greeting for now)
            await geminiSession.connect(true); // skipGreeting = true
            console.log('[VoiceChat] ✓ Gemini session connected');

            // Step 2: Initialize AudioContext
            await audioPlayback.initialize();
            console.log('[VoiceChat] ✓ AudioContext initialized');

            // Step 3: Start microphone recording
            await audioCapture.startRecording(geminiSession.sendAudio);
            console.log('[VoiceChat] ✓ Microphone started');

            // Step 4: Send greeting to trigger bartender
            geminiSession.sendGreeting();
            console.log('[VoiceChat] ✓ Greeting sent');

            const elapsed = performance.now() - startTime;
            console.log(`[VoiceChat] New session started in ${elapsed.toFixed(0)}ms`);
        } catch (error) {
            console.error('[VoiceChat] Failed to start new session:', error);
            setSessionEnded(true);
        }
    };

    // Combine errors from both session and capture
    const error = geminiSession.error || audioCapture.error;

    return (
        <div className="w-full space-y-6 gap-3">
            {/* Barista image with voice indicator overlay  & Menu*/}
            <div className="flex flex-col lg:flex-row gap-10">
                <div className={`w-full ${showMenu ? 'lg:w-1/3' : 'lg:w-full'}`}>
                    <BaristaImage showVoiceIndicator={audioPlayback.isPlayingAudio} />
                </div>
                {showMenu && (
                    <div className="w-full lg:w-2/3">
                        <MenuCard onClose={() => setShowMenu(false)} />
                    </div>
                )}
            </div>

            {/* Loading state while auto-initializing on page load */}
            {isInitializing && (
                <div className="flex justify-center pt-4">
                    <GradientButton variant="purple-pink" disabled>
                        <Spinner />
                        Preparing session...
                    </GradientButton>
                </div>
            )}

            {/* "Go to bar" button - shown after session ends */}
            {sessionEnded && !isInitializing && (
                <div className="flex justify-center pt-4">
                    <GradientButton variant="purple-pink" onClick={handleGoToBar}>
                        Go to bar
                    </GradientButton>
                </div>
            )}

            {/* "Finish your order" button - shown when recording */}
            {!isInitializing && !sessionEnded && !isClosing && audioCapture.isRecording && (
                <div className="flex justify-center pt-4">
                    <GradientButton variant="ghost" onClick={handleDisconnect}>
                        Finish your order
                    </GradientButton>
                </div>
            )}

            {/* "Saying goodbye..." indicator - shown when session is closing */}
            {isClosing && (
                <div className="flex justify-center pt-4">
                    <GradientButton variant="ghost" disabled>
                        Saying goodbye...
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
