import {useState, useEffect} from 'react';
import {calculateVolumeLevel} from '@/lib/audio/capture';

interface UseVolumeLevelReturn {
    volumeLevel: number; // 0-100
}

/**
 * Custom hook for calculating real-time audio volume level.
 * Polls the analyser node at 50ms intervals to update volume visualization.
 *
 * @param analyser - AnalyserNode from audio capture, or null if not recording
 * @param isActive - Whether volume calculation should be active
 * @returns Current volume level as a percentage (0-100)
 */
export function useVolumeLevel(analyser: AnalyserNode | null, isActive: boolean): UseVolumeLevelReturn {
    const [volumeLevel, setVolumeLevel] = useState(0);

    useEffect(() => {
        // Only run if we have an analyser and are actively recording
        if (!isActive || !analyser) {
            setVolumeLevel(0);
            return;
        }

        // Poll volume level every 50ms for smooth visualization
        const intervalId = setInterval(() => {
            const level = calculateVolumeLevel(analyser);
            setVolumeLevel(level);
        }, 50);

        // Cleanup interval on unmount or when inactive
        return () => {
            clearInterval(intervalId);
            setVolumeLevel(0);
        };
    }, [analyser, isActive]);

    return {volumeLevel};
}
