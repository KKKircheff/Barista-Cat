import { Alert, AlertDescription } from '@/components/ui/alert';

interface ErrorAlertProps {
  error: string | null;
}

/**
 * Error alert component displaying error messages.
 * Uses destructive variant with custom red translucent styling.
 */
export function ErrorAlert({ error }: ErrorAlertProps) {
  if (!error) return null;

  return (
    <Alert className="bg-red-500/20 border-red-500/50 text-red-200">
      <AlertDescription>
        <strong>Error:</strong> {error}
      </AlertDescription>
    </Alert>
  );
}
