import {useRef, useState} from 'react';
import {createAudioProcessor} from '@/lib/audio/capture';

interface UseAudioCaptureReturn {
    isRecording: boolean;
    startRecording: (onChunk: (base64Audio: string) => void) => Promise<void>;
    stopRecording: () => void;
    analyser: AnalyserNode | null;
    error: string | null;
}

/**
 * Custom hook for managing microphone audio capture.
 * Handles microphone permissions, audio processing, and cleanup.
 *
 * @returns Audio capture controls, analyser node for visualization, and error state
 */
export function useAudioCapture(): UseAudioCaptureReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
    const [error, setError] = useState<string | null>(null);

    const audioProcessorRef = useRef<ReturnType<typeof createAudioProcessor> | null>(null);
    const stopCaptureRef = useRef<(() => void) | null>(null);

    const startRecording = async (onChunk: (base64Audio: string) => void): Promise<void> => {
        try {
            setError(null);
            setIsRecording(true);

            // Create audio processor
            const processor = createAudioProcessor();
            audioProcessorRef.current = processor;

            // Start capturing and sending audio chunks
            const stopCapture = await processor.start(onChunk);
            stopCaptureRef.current = stopCapture;

            // Get analyser for volume visualization (after start creates it)
            const analyserNode = processor.getAnalyser();
            setAnalyser(analyserNode);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to start recording';
            setError(message);
            setIsRecording(false);
            setAnalyser(null);
            throw err;
        }
    };

    const stopRecording = (): void => {
        // Stop capture
        if (stopCaptureRef.current) {
            stopCaptureRef.current();
            stopCaptureRef.current = null;
        }

        // Clean up refs
        audioProcessorRef.current = null;
        setAnalyser(null);
        setIsRecording(false);
        setError(null);
    };

    return {
        isRecording,
        startRecording,
        stopRecording,
        analyser,
        error,
    };
}
