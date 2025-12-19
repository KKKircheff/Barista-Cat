import { Progress } from '@/components/ui/progress';

interface VolumeBarProps {
  level: number; // 0-100
  show: boolean;
}

/**
 * Audio volume visualization bar.
 * Displays a green-to-blue gradient progress bar showing real-time audio input level.
 */
export function VolumeBar({ level, show }: VolumeBarProps) {
  if (!show) return null;

  return (
    <div className="w-full max-w-xs mx-auto">
      <Progress
        value={level}
        className="h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-green-400 [&>div]:to-blue-500 [&>div]:transition-all [&>div]:duration-75"
      />
    </div>
  );
}
