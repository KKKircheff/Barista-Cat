import { ScrollArea } from '@/components/ui/scroll-area';
import { TranscriptMessage } from './transcript-message';
import type { Message } from '@/lib/types';

interface TranscriptDisplayProps {
  messages: Message[];
}

/**
 * Scrollable transcript display showing conversation history.
 * Uses ScrollArea for smooth scrolling with max height of 256px.
 */
export function TranscriptDisplay({ messages }: TranscriptDisplayProps) {
  if (messages.length === 0) return null;

  return (
    <ScrollArea className="h-64 w-full">
      <div className="space-y-2 pr-4">
        {messages.map((message, index) => (
          <TranscriptMessage key={index} message={message} />
        ))}
      </div>
    </ScrollArea>
  );
}
