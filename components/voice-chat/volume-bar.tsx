import { Progress } from '@/components/ui/progress';

interface VolumeBarProps {
  level: number;
  show: boolean;
  isSpeechDetected?: boolean;
}

export function VolumeBar({ level, show, isSpeechDetected = false }: VolumeBarProps) {
  if (!show) return null;

  const gradientClass = isSpeechDetected
    ? '[&>div]:from-green-400 [&>div]:to-blue-500'
    : '[&>div]:from-gray-400 [&>div]:to-gray-500';

  return (
    <div className="w-full max-w-xs mx-auto">
      <Progress
        value={level}
        className={`h-2 bg-white/10 [&>div]:bg-gradient-to-r ${gradientClass} [&>div]:transition-all [&>div]:duration-300`}
      />
    </div>
  );
}
