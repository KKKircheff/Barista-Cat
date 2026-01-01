# Hook Patterns and Conventions

This file is automatically loaded when working with files matching `hooks/**/*.ts`.

## Core Principles

### Single Responsibility
Each hook manages ONE concern:
- `use-gemini-session` → WebSocket lifecycle only
- `use-audio-capture` → Microphone capture only
- `use-audio-playback` → Audio playback only
- `use-volume-level` → Volume visualization only
- `use-vad` → Voice activity detection only

**Don't:** Create hooks that combine multiple concerns (e.g., "use-audio" that handles both capture AND playback).

**Do:** Create focused hooks that compose well together.

### Return Object Pattern

All hooks return objects with clear, descriptive keys:

```typescript
interface UseGeminiSessionReturn {
  isConnected: boolean;           // State
  connect: () => Promise<void>;   // Action
  disconnect: () => void;         // Action
  sendAudio: (base64: string) => void;  // Action
  error: string | null;           // Error state
  tokenUsage: TokenUsage | null;  // Derived state
}
```

**Advantages:**
- Destructure only what you need
- Clear naming at call site
- TypeScript autocomplete
- Easy to extend without breaking changes

**Don't:**
```typescript
const [session, connect, disconnect] = useGeminiSession();  // Array return
```

**Do:**
```typescript
const { isConnected, connect, disconnect } = useGeminiSession();  // Object return
```

## Performance Optimization

### useCallback for Audio Processing

**Why:** Audio processing functions are called frequently (every 40ms). Re-creating them on every render causes performance issues.

**Pattern:**

```typescript
const handleMessage = useCallback(
  (message: LiveServerMessage) => {
    // Process message
    if (options?.onMessage) {
      options.onMessage(parsed);
    }
  },
  [options]  // Only re-create if options change
);
```

**When to use:**
- Functions passed to child components as props
- Functions called in tight loops (audio processing)
- Functions used in useEffect dependencies
- Event handlers for audio/WebSocket events

**When NOT to use:**
- Simple onClick handlers in UI components
- Functions that aren't passed as dependencies
- Functions called rarely

### useMemo for Expensive Calculations

**Pattern:**

```typescript
const volumeLevel = useMemo(() => {
  if (!analyser || !isRecording) return 0;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  // Expensive calculation
  const sum = dataArray.reduce((acc, val) => acc + val * val, 0);
  return Math.sqrt(sum / dataArray.length);
}, [analyser, isRecording]);  // Recalculate only when these change
```

**When to use:**
- Audio analysis calculations
- Buffer transformations
- Heavy array operations

**When NOT to use:**
- Simple state derivations
- Object/array creation (unless large)

## Ref Patterns

### useRef for Mutable References

**Use cases in this codebase:**

1. **Persistent objects** (don't trigger re-renders):
```typescript
const sessionRef = useRef<LiveSession | null>(null);  // WebSocket connection
const vadFilterRef = useRef<VADFilter | null>(null);  // VAD filter instance
```

2. **Previous values** (for comparison):
```typescript
const prevVolumeRef = useRef<number>(0);
```

3. **DOM nodes** (for direct manipulation):
```typescript
const audioContextRef = useRef<AudioContext | null>(null);
```

**Why useRef instead of useState?**
- Changes don't trigger re-renders
- Synchronous access (no stale closure issues)
- Mutable (can update without setState)

**Pattern:**

```typescript
// Create ref
const sessionRef = useRef<LiveSession | null>(null);

// Update (doesn't trigger re-render)
sessionRef.current = newSession;

// Access (always current value)
if (sessionRef.current) {
  sessionRef.current.sendAudio(data);
}

// Cleanup
useEffect(() => {
  return () => {
    sessionRef.current?.close();
    sessionRef.current = null;
  };
}, []);
```

## Error Handling

### State-Based Error Pattern

All hooks use `useState` for errors:

```typescript
const [error, setError] = useState<string | null>(null);

// Set error
setError('Failed to connect to Gemini');

// Clear error
setError(null);

// Return error in hook interface
return { error, /* other values */ };
```

**Advantages:**
- Errors trigger re-renders (UI can show error state)
- TypeScript ensures error handling
- Parent component decides how to display

**Pattern:**

```typescript
try {
  await riskyOperation();
  setError(null);  // Clear previous errors
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  setError(message);

  // Optionally notify parent
  if (options?.onError) {
    options.onError(err instanceof Error ? err : new Error(message));
  }
}
```

### Graceful Degradation

**Example:** VAD failure should not break the app.

```typescript
// In use-vad.ts
if (!options.enabled || vadError) {
  return {
    isSpeechDetected: true,  // Fallback: always-on (no filtering)
    isVADLoading: false,
    vadError: vadError || (options.enabled ? null : 'VAD disabled'),
    pauseVAD: () => {},      // No-op
    resumeVAD: () => {}      // No-op
  };
}
```

**Effect:** If VAD fails, audio still works (just without filtering).

## Cleanup Patterns

### Always Cleanup in useEffect

**Pattern:**

```typescript
useEffect(() => {
  // Setup
  const resource = createResource();

  // Cleanup function (called on unmount or dependencies change)
  return () => {
    resource.cleanup();
  };
}, [dependencies]);
```

**Examples:**

1. **WebSocket cleanup:**
```typescript
useEffect(() => {
  return () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
  };
}, []);
```

2. **Audio cleanup:**
```typescript
useEffect(() => {
  return () => {
    audioCapture.stopRecording();
    audioPlayback.stop();
  };
}, []);
```

3. **Timer cleanup:**
```typescript
useEffect(() => {
  const interval = setInterval(() => updateVolume(), 16);

  return () => {
    clearInterval(interval);
  };
}, []);
```

### Why Cleanup Matters

**Without cleanup:**
- Memory leaks (WebSocket connections left open)
- Multiple instances running (audio playing twice)
- Race conditions (old effects still running)

**With cleanup:**
- Predictable behavior
- No resource leaks
- Safe hot-reloading in development

## Hook Composition

### Orchestrator Pattern

**File:** `components/voice-chat/voice-chat.tsx`

**Pattern:** Main component composes multiple hooks:

```typescript
export function VoiceChat() {
  // 1. Each hook manages its own concern
  const audioPlayback = useAudioPlayback(24000);
  const audioCapture = useAudioCapture();
  const volumeLevel = useVolumeLevel(audioCapture.analyser, audioCapture.isRecording);
  const vad = useVAD({ enabled: true });
  const geminiSession = useGeminiSession({
    onMessage: (message) => {
      if (message.audioData) {
        audioPlayback.play(message.audioData);  // Hook coordination
      }
    }
  });

  // 2. Component coordinates hook interactions
  useEffect(() => {
    if (volumeLevel.volumeLevel > 15 && audioPlayback.isPlayingAudio) {
      audioPlayback.emergencyStop();  // Interruption logic
    }
  }, [volumeLevel.volumeLevel, audioPlayback.isPlayingAudio]);

  return <UI />; // Pure presentation
}
```

**Key principles:**
- Component doesn't implement business logic
- Hooks are independent (can be tested separately)
- Component handles only coordination

### Hook Dependencies

**Be careful with hook dependencies:**

```typescript
// ❌ Bad: Passing entire hook object as dependency
useEffect(() => {
  geminiSession.connect();
}, [geminiSession]);  // Will re-run every render!

// ✅ Good: Extract specific values
const { connect, isConnected } = geminiSession;
useEffect(() => {
  if (!isConnected) {
    connect();
  }
}, [connect, isConnected]);

// ✅ Better: Use ref for stable function reference
const connectRef = useRef(geminiSession.connect);
useEffect(() => {
  connectRef.current = geminiSession.connect;
});
```

## Testing Hooks

### Testable Hook Structure

Hooks should be testable in isolation:

```typescript
// ✅ Good: Pure logic, testable
export function useVolumeLevel(analyser: AnalyserNode | null, isRecording: boolean) {
  const [volumeLevel, setVolumeLevel] = useState(0);

  useEffect(() => {
    if (!analyser || !isRecording) return;

    const updateVolume = () => {
      const level = calculateVolume(analyser);  // Pure function
      setVolumeLevel(level);
    };

    const interval = setInterval(updateVolume, 16);
    return () => clearInterval(interval);
  }, [analyser, isRecording]);

  return { volumeLevel };
}

// Test calculateVolume separately
function calculateVolume(analyser: AnalyserNode): number {
  // Pure calculation
}
```

## Common Patterns in This Codebase

### Option Objects for Configuration

```typescript
interface UseGeminiSessionOptions {
  onMessage?: (message: ParsedServerMessage) => void;
  onFunctionCall?: (functionName: string, args?: any) => void;
  onError?: (error: Error) => void;
}

export function useGeminiSession(options?: UseGeminiSessionOptions) {
  // ...
}
```

**Advantages:**
- Optional parameters
- Clear intent
- Easy to extend
- TypeScript ensures type safety

### Conditional Hook Execution

```typescript
// ❌ Bad: Conditionally call hook
if (shouldUseVAD) {
  const vad = useVAD({ enabled: true });  // Breaks Rules of Hooks!
}

// ✅ Good: Always call hook, pass condition as parameter
const vad = useVAD({ enabled: shouldUseVAD });
```

### Async Operations in useEffect

```typescript
// ❌ Bad: Async useEffect directly
useEffect(async () => {
  await connect();  // TypeScript error!
}, []);

// ✅ Good: Async function inside useEffect
useEffect(() => {
  const doConnect = async () => {
    try {
      await connect();
    } catch (err) {
      setError(err.message);
    }
  };

  doConnect();
}, []);
```

## File Naming

All hooks follow the pattern: `use-<functionality>.ts`

Examples:
- `use-gemini-session.ts` (not `geminiSession.ts`)
- `use-audio-capture.ts` (not `audioCapture.ts`)
- `use-vad.ts` (not `vad.ts`)

**Why:** Immediately identifies files as hooks. Matches React convention.
