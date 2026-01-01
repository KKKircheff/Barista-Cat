# Component Patterns and Conventions

This file is automatically loaded when working with files matching `components/**/*.tsx`.

## Core Principle: Server-First Components

### Default: Server Components

**All components are Server Components by default** in Next.js 16 App Router.

**Benefits:**
- Rendered on server (smaller client bundle)
- Direct database access (if needed)
- Better SEO
- Faster initial page load

**Pattern:**

```typescript
// No 'use client' directive = Server Component
export function BaristaImage({ showVoiceIndicator }: Props) {
  return (
    <div className="relative">
      <Image src="/images/barista-cat.png" alt="Whiskerjack" />
      {showVoiceIndicator && <VoiceIndicator />}
    </div>
  );
}
```

### When to use 'use client'

**ONLY add 'use client' when component needs:**

1. **React Hooks** (useState, useEffect, useRef, custom hooks)
2. **Event Handlers** (onClick, onChange, onSubmit)
3. **Browser APIs** (window, document, localStorage)
4. **Client-side Libraries** (animation libraries, audio APIs)

**Examples from this codebase:**

```typescript
// ✅ Needs 'use client' - uses hooks
'use client';
export function VoiceChat() {
  const [showMenu, setShowMenu] = useState(false);
  const geminiSession = useGeminiSession();
  // ...
}

// ✅ Needs 'use client' - uses useMemo for animation
'use client';
export function VoiceIndicator() {
  const bars = useMemo(() => generateBars(), []);
  // ...
}

// ❌ No 'use client' needed - pure presentation
export function MenuCard({ onClose }: Props) {
  return (
    <Card>
      <button onClick={onClose}>Close</button>  {/* onClick passed from client parent */}
    </Card>
  );
}
```

**Important:** `onClick` in a Server Component is OK if the handler comes from a Client Component parent.

## Orchestrator Pattern

### Main Orchestrator: voice-chat.tsx

**Purpose:** Coordinate multiple hooks without implementing business logic.

**Structure:**

```typescript
'use client';
export function VoiceChat() {
  // 1. State (UI-specific only)
  const [showMenu, setShowMenu] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // 2. Business logic hooks (all concerns delegated)
  const audioPlayback = useAudioPlayback(24000);
  const audioCapture = useAudioCapture();
  const volumeLevel = useVolumeLevel(analyser, isRecording);
  const vad = useVAD({ enabled: true });
  const geminiSession = useGeminiSession({
    onMessage: handleMessage,      // Coordinate hooks
    onFunctionCall: handleFunctionCall
  });

  // 3. Coordination logic (cross-cutting concerns)
  useEffect(() => {
    // Interruption detection (combines volume + VAD + playback state)
    if (volumeLevel.volumeLevel > 15 && vad.isSpeechDetected && audioPlayback.isPlayingAudio) {
      audioPlayback.emergencyStop();
    }
  }, [volumeLevel, vad, audioPlayback]);

  // 4. Pure presentation
  return (
    <div>
      <BaristaImage showVoiceIndicator={audioPlayback.isPlayingAudio} />
      {showMenu && <MenuCard onClose={() => setShowMenu(false)} />}
    </div>
  );
}
```

**What orchestrator DOES:**
- Compose multiple hooks
- Translate hook data to UI state
- Handle cross-cutting concerns (interruptions)
- Coordinate hook interactions

**What orchestrator DOES NOT:**
- Implement audio processing (delegated to use-audio-playback)
- Implement WebSocket logic (delegated to use-gemini-session)
- Implement VAD (delegated to use-vad)

### Sub-Components: Pure Presentation

**All other components are pure presentation:**

```typescript
interface MenuCardProps {
  onClose: () => void;  // Receive handlers from parent
}

export function MenuCard({ onClose }: MenuCardProps) {
  return (
    <Card>
      <ScrollArea>
        {/* Static content */}
      </ScrollArea>
      <button onClick={onClose}>Close</button>
    </Card>
  );
}
```

**No business logic:**
- No API calls
- No WebSocket connections
- No audio processing
- Just UI rendering

## Props and TypeScript

### Interface Naming Convention

```typescript
// Pattern: <ComponentName>Props
interface BaristaImageProps {
  showVoiceIndicator: boolean;
}

export function BaristaImage({ showVoiceIndicator }: BaristaImageProps) {
  // ...
}
```

### Props Destructuring

**Do:** Destructure props in function signature:

```typescript
// ✅ Clear, concise
export function TokenUsageDisplay({ usage, isConnected }: TokenUsageDisplayProps) {
  // Use usage and isConnected directly
}
```

**Don't:** Use props object:

```typescript
// ❌ Verbose
export function TokenUsageDisplay(props: TokenUsageDisplayProps) {
  return <div>{props.usage?.totalTokenCount}</div>;
}
```

### Optional vs Required Props

```typescript
interface VolumeBarProps {
  level: number;              // Required
  show: boolean;              // Required
  isSpeechDetected?: boolean; // Optional (? suffix)
}

export function VolumeBar({ level, show, isSpeechDetected = false }: VolumeBarProps) {
  //                                   Default value ^^^^^^^^^^^
}
```

## Component Structure

### File Organization

```
components/
├── ui/                    # Primitive UI components (Shadcn)
│   ├── button.tsx
│   ├── card.tsx
│   └── progress.tsx
├── shared/                # Reusable feature components
│   ├── gradient-button.tsx
│   └── gradient-card.tsx
└── voice-chat/            # Feature-specific components
    ├── voice-chat.tsx     # Orchestrator
    ├── barista-image.tsx  # Sub-component
    ├── menu-card.tsx      # Sub-component
    └── voice-indicator.tsx # Sub-component
```

### Component Size

**Guidelines:**
- **Orchestrator** (voice-chat.tsx): 200-300 lines (coordinates many hooks)
- **Feature components** (menu-card.tsx): 50-200 lines
- **Primitive components** (ui/button.tsx): 20-100 lines

**If component exceeds 300 lines:**
1. Extract sub-components for sections
2. Move business logic to hooks
3. Split into multiple feature components

## Styling with Tailwind

### Pattern: Utility-First

```typescript
export function VoiceIndicator() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative w-full h-full">
        {/* Utility classes only */}
      </div>
    </div>
  );
}
```

### cn() Helper for Conditional Classes

```typescript
import { cn } from '@/lib/utils';

export function GradientButton({ variant, disabled, className, children }: Props) {
  return (
    <button
      className={cn(
        'base-classes',
        variant === 'purple-pink' && 'variant-specific-classes',
        disabled && 'opacity-50 cursor-not-allowed',
        className  // Allow parent to override
      )}
    >
      {children}
    </button>
  );
}
```

**Why cn()?**
- Merges Tailwind classes correctly
- Handles conditional classes
- Deduplicates conflicting classes

### Avoid Inline Styles

**Don't:**
```typescript
<div style={{ background: 'linear-gradient(...)' }}>  // ❌
```

**Do:**
```typescript
<div className="bg-gradient-to-r from-purple-500 to-pink-500">  // ✅
```

**Exception:** Dynamic values not possible with Tailwind:

```typescript
<div style={{ width: `${volumeLevel}%` }}>  // ✅ OK for dynamic width
```

## Event Handlers

### Naming Convention

```typescript
// Pattern: handle<Action>
const handleDisconnect = () => { /* ... */ };
const handleGoToBar = () => { /* ... */ };
const handleFunctionCall = (name: string) => { /* ... */ };
```

### Inline vs Extracted Handlers

**Inline:** Simple, one-line handlers:

```typescript
<button onClick={() => setShowMenu(false)}>Close</button>
```

**Extracted:** Complex or reused handlers:

```typescript
const handleDisconnect = () => {
  audioCapture.stopRecording();
  audioPlayback.stop();
  geminiSession.disconnect();
  setShowMenu(false);
  setSessionEnded(true);
};

<button onClick={handleDisconnect}>Disconnect</button>
```

### Async Event Handlers

```typescript
const handleGoToBar = async () => {
  try {
    setIsLoading(true);
    await geminiSession.connect();
    await audioPlayback.initialize();
    await audioCapture.startRecording(onAudioData);
  } catch (error) {
    console.error('Failed to start session:', error);
    setError(error.message);
  } finally {
    setIsLoading(false);
  }
};
```

## Conditional Rendering

### Pattern: Boolean Flags

```typescript
// ✅ Clear intent
{isInitializing && <LoadingSpinner />}
{sessionEnded && <GoToBarButton />}
{error && <ErrorAlert error={error} />}
```

### Pattern: Ternary for Either/Or

```typescript
// ✅ Either loading or content
{isLoading ? <Spinner /> : <Content />}
```

### Pattern: Function for Complex Logic

```typescript
const renderButton = () => {
  if (isInitializing) return <Spinner />;
  if (sessionEnded) return <GoToBarButton />;
  if (isClosing) return <ClosingMessage />;
  return <FinishOrderButton />;
};

return <div>{renderButton()}</div>;
```

## State Management

### Local State Only

**This codebase uses NO global state management** (no Redux, Zustand, etc.).

**All state is:**
1. Local component state (useState)
2. Hook state (returned from custom hooks)
3. Props (passed from parent)

**Why this works:**
- Single main component (voice-chat.tsx)
- No deep prop drilling (hooks handle state)
- Clear data flow

### State Colocation

**Place state as close to where it's used as possible:**

```typescript
// ✅ Good: Menu state in VoiceChat (only component that needs it)
export function VoiceChat() {
  const [showMenu, setShowMenu] = useState(false);
  // ...
  return <MenuCard show={showMenu} onClose={() => setShowMenu(false)} />;
}

// ❌ Bad: Menu state in global context (unnecessary)
const MenuContext = createContext();  // Overkill for single boolean
```

## Children and Composition

### Pattern: Render Props

**Example from Shadcn UI:**

```typescript
<Card>
  <CardHeader>
    <CardTitle>Menu</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content here */}
  </CardContent>
</Card>
```

**Why:** Flexible composition, clear structure.

### Pattern: Children Prop

```typescript
interface GradientButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'purple-pink' | 'ghost';
}

export function GradientButton({ children, onClick, variant }: Props) {
  return (
    <button className={cn(/* ... */)} onClick={onClick}>
      {children}  {/* Flexible content */}
    </button>
  );
}

// Usage
<GradientButton variant="purple-pink">
  <Spinner />  {/* Can pass any content */}
  Preparing session...
</GradientButton>
```

## Performance

### React.memo for Expensive Components

**Use React.memo sparingly:**

```typescript
// ✅ Good use case: Expensive animation component
export const VoiceIndicator = React.memo(function VoiceIndicator({ isActive }: Props) {
  const bars = useMemo(() => generateBars(60), []);  // 60 circular bars
  return <AnimatedBars bars={bars} isActive={isActive} />;
});
```

**Don't use React.memo for:**
- Simple components (button, text, etc.)
- Components that re-render frequently anyway
- Components without expensive rendering

### useMemo for Expensive Computations

```typescript
// ✅ Good: Generate 60 bar positions once
const bars = useMemo(() => {
  return Array.from({ length: 60 }, (_, i) => ({
    angle: (i / 60) * 360,
    radius: 50,
    // ... expensive calculations
  }));
}, []);  // Empty deps = compute once
```

## Error Boundaries

**Currently not implemented** but should be added for production:

```typescript
// Future improvement: Error boundary for VoiceChat
<ErrorBoundary fallback={<ErrorPage />}>
  <VoiceChat />
</ErrorBoundary>
```

## Accessibility

### Semantic HTML

```typescript
// ✅ Use semantic elements
<button onClick={handleClick}>Close</button>  // Not <div>

<nav>  // Not <div className="nav">
  <a href="/">Home</a>
</nav>
```

### ARIA Labels

```typescript
// ✅ Provide labels for screen readers
<button aria-label="Close menu" onClick={onClose}>
  <X className="h-6 w-6" />  {/* Icon only, no text */}
</button>
```

### Keyboard Navigation

**Shadcn UI components handle this automatically:**

```typescript
// ScrollArea, Button, Card, etc. all have proper keyboard support
<ScrollArea>
  <button>Tab-navigable</button>
</ScrollArea>
```

## Common Anti-Patterns to Avoid

### ❌ Business Logic in Components

```typescript
// ❌ Bad: Audio processing in component
export function VoiceChat() {
  const [audioData, setAudioData] = useState<string>('');

  const processAudio = (raw: ArrayBuffer) => {
    // Complex audio processing here  ← Should be in hook!
  };
}
```

**Fix:** Move to `use-audio-capture` hook.

### ❌ Direct DOM Manipulation

```typescript
// ❌ Bad: Direct DOM manipulation
useEffect(() => {
  document.getElementById('menu').style.display = 'block';
}, []);
```

**Fix:** Use React state:

```typescript
// ✅ Good: React state
const [showMenu, setShowMenu] = useState(false);
{showMenu && <Menu />}
```

### ❌ Prop Drilling Through Many Levels

```typescript
// ❌ Bad: Passing props through 5 levels
<VoiceChat session={session}>
  <Controls session={session}>
    <Button session={session}>
      {/* ... */}
    </Button>
  </Controls>
</VoiceChat>
```

**Fix:** Use custom hooks to access state directly:

```typescript
// ✅ Good: Hooks provide state where needed
export function Button() {
  const { disconnect } = useGeminiSession();  // Direct access
  return <button onClick={disconnect}>Disconnect</button>;
}
```

**Note:** This codebase doesn't have this issue because state is localized.

## Testing Components

### Component Structure for Testing

```typescript
// ✅ Testable: Pure presentation
export function MenuCard({ drinks, onClose }: Props) {
  return (
    <Card>
      {drinks.map(drink => <DrinkItem key={drink.id} {...drink} />)}
      <button onClick={onClose}>Close</button>
    </Card>
  );
}

// Test: Verify rendering and interactions
test('MenuCard renders drinks', () => {
  const drinks = [{ id: 1, name: 'Coffee' }];
  render(<MenuCard drinks={drinks} onClose={jest.fn()} />);
  expect(screen.getByText('Coffee')).toBeInTheDocument();
});
```

**Business logic tested in hooks, not components.**
