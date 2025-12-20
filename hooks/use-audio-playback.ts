import { useEffect, useRef, useState } from 'react';
import { createAudioPlayer } from '@/lib/audio/playback';

interface UseAudioPlaybackReturn {
  play: (base64Audio: string) => Promise<void>;
  stop: () => void;
  isPlayingAudio: boolean; // Renamed from isPlaying for clarity
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
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Initialize audio player on mount
  useEffect(() => {
    const player = createAudioPlayer(sampleRate);
    audioPlayerRef.current = player;

    // Subscribe to playback state changes
    player.setOnPlaybackStateChange((playing) => {
      setIsPlayingAudio(playing);
    });

    // Cleanup on unmount
    return () => {
      player.cleanup();
    };
  }, [sampleRate]);

  const play = async (base64Audio: string): Promise<void> => {
    if (!audioPlayerRef.current) {
      throw new Error('Audio player not initialized');
    }

    try {
      await audioPlayerRef.current.play(base64Audio);
    } catch (error) {
      console.error('[useAudioPlayback] Playback error:', error);
      throw error;
    }
  };

  const stop = (): void => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
    }
  };

  return {
    play,
    stop,
    isPlayingAudio,
  };
}
