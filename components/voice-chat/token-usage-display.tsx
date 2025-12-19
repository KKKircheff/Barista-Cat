import { Badge } from '@/components/ui/badge';
import type { TokenUsage } from '@/lib/types';

interface TokenUsageDisplayProps {
  usage: TokenUsage | null;
  isConnected: boolean;
}

/**
 * Token usage display component.
 * Shows input, output, and total token counts in a compact badge format.
 */
export function TokenUsageDisplay({ usage, isConnected }: TokenUsageDisplayProps) {
  // Don't show if not connected
  if (!isConnected) {
    return null;
  }

  // Format large numbers with K/M suffix
  const formatTokenCount = (count?: number): string => {
    if (count === undefined) return '-';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  // If no usage data available yet
  if (!usage || !usage.totalTokenCount) {
    return (
      <Badge
        variant="outline"
        className="bg-slate-400/10 text-slate-300 border-slate-400/30 text-xs"
      >
        Tokens: N/A
      </Badge>
    );
  }

  const inputTokens = formatTokenCount(usage.promptTokenCount);
  const outputTokens = formatTokenCount(usage.candidatesTokenCount);
  const totalTokens = formatTokenCount(usage.totalTokenCount);

  return (
    <Badge
      variant="outline"
      className="bg-blue-400/10 text-blue-100 border-blue-400/30 text-xs font-mono"
    >
      <span className="opacity-70">In:</span> {inputTokens}
      <span className="mx-1 opacity-50">|</span>
      <span className="opacity-70">Out:</span> {outputTokens}
      <span className="mx-1 opacity-50">|</span>
      <span className="opacity-70">Total:</span> {totalTokens}
    </Badge>
  );
}
