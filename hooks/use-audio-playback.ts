import { useEffect, useRef, useState } from 'react';
import { createAudioPlayer } from '@/lib/audio/playback';

interface UseAudioPlaybackReturn {
  play: (base64Audio: string) => Promise<void>;
  stop: () => void;
  isPlaying: boolean;
}

/**
 * Custom hook for managing audio playback from Gemini responses.
 * Wraps the createAudioPlayer utility with React lifecycle management.
 *
 * @param sampleRate - Audio sample rate (default: 24000 Hz for Gemini)
 * @returns Audio playback controls and status
 */
export function useAudioPlayback(sampleRate: number = 24000): UseAudioPlaybackReturn {
  const audioPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Initialize audio player on mount
  useEffect(() => {
    audioPlayerRef.current = createAudioPlayer(sampleRate);

    // Cleanup on unmount
    return () => {
      audioPlayerRef.current?.cleanup();
    };
  }, [sampleRate]);

  const play = async (base64Audio: string): Promise<void> => {
    if (!audioPlayerRef.current) {
      throw new Error('Audio player not initialized');
    }

    try {
      setIsPlaying(true);
      await audioPlayerRef.current.play(base64Audio);
    } catch (error) {
      console.error('[useAudioPlayback] Playback error:', error);
      throw error;
    } finally {
      setIsPlaying(false);
    }
  };

  const stop = (): void => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      setIsPlaying(false);
    }
  };

  return {
    play,
    stop,
    isPlaying,
  };
}
