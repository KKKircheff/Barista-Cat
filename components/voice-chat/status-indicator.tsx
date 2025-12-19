import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusIndicatorProps {
  isConnected: boolean;
}

/**
 * Status indicator showing connection state with animated dot.
 * Displays a pulsing green dot when connected, static red dot when disconnected.
 */
export function StatusIndicator({ isConnected }: StatusIndicatorProps) {
  return (
    <Badge
      className={cn(
        'gap-2 px-3 py-1.5',
        isConnected
          ? 'bg-green-400/20 text-green-100 border-green-400/50'
          : 'bg-red-400/20 text-red-100 border-red-400/50'
      )}
    >
      <span
        className={cn(
          'size-2 rounded-full',
          isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
        )}
      />
      {isConnected ? 'Connected' : 'Disconnected'}
    </Badge>
  );
}
