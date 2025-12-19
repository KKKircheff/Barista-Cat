// Pre-buffering configuration
const PRE_BUFFER_COUNT = 10; // Wait for 10 chunks before starting playback (~400ms safety buffer)
const REBUFFER_THRESHOLD = 3; // Re-buffer if queue drops below this during playback
const LOW_BUFFER_THRESHOLD = 5; // Warn when queue drops to 5 chunks
const SCHEDULE_AHEAD_COUNT = 3; // Always keep 3 chunks scheduled ahead

export function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes;
}

export function uint8ToInt16(uint8Array: Uint8Array): Int16Array {
    return new Int16Array(uint8Array.buffer, uint8Array.byteOffset, uint8Array.length / 2);
}

export function int16ToFloat32(int16Array: Int16Array): Float32Array {
    const float32Array = new Float32Array(int16Array.length);

    for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7fff);
    }

    return float32Array;
}

export function base64ToFloat32(base64: string): Float32Array {
    return int16ToFloat32(uint8ToInt16(base64ToUint8Array(base64)));
}

export function createAudioPlayer(sampleRate: number = 24000) {
    let audioContext: AudioContext | null = null;
    let gainNode: GainNode | null = null;
    let currentSource: AudioBufferSourceNode | null = null;
    const audioQueue: AudioBuffer[] = [];
    let isPlaying = false;
    let nextScheduledTime = 0; // Track when next chunk should start
    const activeSources: AudioBufferSourceNode[] = []; // Track all playing sources
    let hasStartedPlayback = false; // Track if we've started initial playback
    let isRebuffering = false; // Track if we're in re-buffering state
    let scheduledChunks = 0; // Track how many chunks have been scheduled ahead

    // Initialize audio context
    const init = () => {
        if (!audioContext) {
            audioContext = new AudioContext({sampleRate});
            gainNode = audioContext.createGain();
            gainNode.connect(audioContext.destination);
            nextScheduledTime = audioContext.currentTime;
        }
    };

    // Helper: Fill the look-ahead buffer to maintain gapless playback
    const fillLookAheadBuffer = () => {
        while (audioQueue.length > 0 && scheduledChunks < SCHEDULE_AHEAD_COUNT) {
            playNext();
        }
    };

    // Play next audio buffer in queue with precise scheduling
    const playNext = () => {
        if (!audioContext || !gainNode || audioQueue.length === 0) {
            // Check if we should mark as not playing
            if (activeSources.length === 0) {
                isPlaying = false;
            }
            return;
        }

        // Re-buffering logic: pause scheduling if buffer is too low
        if (hasStartedPlayback && audioQueue.length < REBUFFER_THRESHOLD && !isRebuffering) {
            isRebuffering = true;
            console.warn(
                `[Audio] Re-buffering... (queue: ${audioQueue.length}, waiting for ${REBUFFER_THRESHOLD + 2} chunks)`
            );
            return; // Don't schedule more chunks until buffer recovers
        }

        // Don't schedule more than SCHEDULE_AHEAD_COUNT chunks
        if (scheduledChunks >= SCHEDULE_AHEAD_COUNT) {
            return;
        }

        isPlaying = true;
        const buffer = audioQueue.shift()!;
        scheduledChunks++; // Increment scheduled count

        // Monitor queue health
        if (audioQueue.length <= LOW_BUFFER_THRESHOLD) {
            console.warn(`[Audio] Low buffer warning: ${audioQueue.length} chunks remaining`);
        }

        // Calculate when this chunk should start
        const now = audioContext.currentTime;

        // If nextScheduledTime is too far in the past (>1 second), reset it
        // This handles tab backgrounding or long pauses
        if (nextScheduledTime < now - 1.0) {
            console.warn(
                `[Audio] Resetting stale nextScheduledTime (was ${nextScheduledTime.toFixed(3)}, now is ${now.toFixed(
                    3
                )})`
            );
            nextScheduledTime = now;
        }

        // If we're behind schedule, catch up by playing immediately
        // Otherwise, schedule for the precise time to avoid gaps
        const startTime = Math.max(now, nextScheduledTime);

        // Schedule the next chunk to start when this one ends
        nextScheduledTime = startTime + buffer.duration;

        // Create and configure source
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNode);

        // Track this source
        activeSources.push(source);
        currentSource = source;

        // Clean up when finished
        source.onended = () => {
            const index = activeSources.indexOf(source);
            if (index > -1) {
                activeSources.splice(index, 1);
            }
            if (source === currentSource) {
                currentSource = null;
            }

            // Decrement scheduled count
            scheduledChunks--;

            // Only try to play next chunk if we're not re-buffering
            // Re-buffering will resume playback when buffer recovers
            if (!isRebuffering) {
                playNext();
            }
        };

        // Start playback at scheduled time
        source.start(startTime);

        // Log for debugging (can be removed in production)
        console.log(
            `[Audio] Playing chunk: duration=${buffer.duration.toFixed(3)}s, queue=${
                audioQueue.length
            }, scheduled=${startTime.toFixed(3)}s, scheduledAhead=${scheduledChunks}, health=${
                audioQueue.length <= LOW_BUFFER_THRESHOLD ? 'LOW' : 'OK'
            }`
        );

        // Schedule more chunks to stay ahead (prevents gaps from onended latency)
        // This schedules up to SCHEDULE_AHEAD_COUNT chunks with precise timing
        if (audioQueue.length > 0 && scheduledChunks < SCHEDULE_AHEAD_COUNT) {
            playNext();
        }
    };

    // Play base64-encoded PCM audio
    const play = async (base64Audio: string): Promise<void> => {
        init();

        if (!audioContext) {
            throw new Error('Failed to initialize AudioContext');
        }

        try {
            // Convert base64 to Float32Array
            const float32Data = base64ToFloat32(base64Audio);

            // Skip empty chunks
            if (float32Data.length === 0) {
                console.warn('[Audio] Received empty audio chunk, skipping');
                return;
            }

            // Create audio buffer
            const audioBuffer = audioContext.createBuffer(1, float32Data.length, sampleRate);
            audioBuffer.getChannelData(0).set(float32Data);

            // Add to queue
            audioQueue.push(audioBuffer);

            // Initial pre-buffering: wait for enough chunks before first playback
            if (!hasStartedPlayback && audioQueue.length >= PRE_BUFFER_COUNT) {
                console.log(`[Audio] Pre-buffer complete (${audioQueue.length} chunks), starting playback`);
                hasStartedPlayback = true;
                isRebuffering = false;
                fillLookAheadBuffer();
            }
            // Re-buffering recovery: resume when buffer has recovered
            else if (isRebuffering && audioQueue.length >= REBUFFER_THRESHOLD + 2) {
                console.log(`[Audio] Re-buffer complete (${audioQueue.length} chunks), resuming playback`);
                isRebuffering = false;
                fillLookAheadBuffer();
            }
            // Ongoing playback: fill look-ahead buffer if we have room
            else if (hasStartedPlayback && !isRebuffering && scheduledChunks < SCHEDULE_AHEAD_COUNT) {
                playNext();
            }
        } catch (error) {
            console.error('[Audio] Playback error:', error);
            throw error;
        }
    };

    // Stop current playback
    const stop = () => {
        // Stop all active sources
        for (const source of activeSources) {
            try {
                source.stop();
                source.disconnect();
            } catch (e) {
                // Source may have already ended
            }
        }
        activeSources.length = 0;
        currentSource = null;
        audioQueue.length = 0;
        isPlaying = false;
        hasStartedPlayback = false; // Reset for next session
        isRebuffering = false; // Reset re-buffering state
        scheduledChunks = 0; // Reset scheduled count

        // Reset scheduling
        if (audioContext) {
            nextScheduledTime = audioContext.currentTime;
        }

        // Add small delay before allowing new playback
        // This prevents race conditions when restarting
        setTimeout(() => {
            console.log('[Audio] Stop complete, ready for new playback');
        }, 100);
    };

    // Set volume (0-1)
    const setVolume = (volume: number) => {
        if (gainNode) {
            gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    };

    // Cleanup
    const cleanup = () => {
        stop();
        if (audioContext) {
            audioContext.close();
            audioContext = null;
            gainNode = null;
        }
    };

    return {
        play,
        stop,
        setVolume,
        cleanup,
        isPlaying: () => isPlaying,
    };
}
