import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Message } from '@/lib/types';

interface TranscriptMessageProps {
  message: Message;
}

/**
 * Individual message bubble in the transcript.
 * Displays with role-specific styling: blue for user, purple for Gemini.
 */
export function TranscriptMessage({ message }: TranscriptMessageProps) {
  const isUser = message.role === 'user';

  return (
    <Card
      className={cn(
        'p-3 transition-all border',
        isUser
          ? 'bg-blue-500/20 text-blue-100 ml-8 border-blue-500/30'
          : 'bg-purple-500/20 text-purple-100 mr-8 border-purple-500/30'
      )}
    >
      <div className="text-xs opacity-60 mb-1">{isUser ? 'You' : 'Gemini'}</div>
      <div className="text-sm">{message.content}</div>
    </Card>
  );
}
