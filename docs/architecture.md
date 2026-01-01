# Architecture: Hook-Based Separation

## Core Architectural Pattern

The codebase uses a **strict separation between business logic (hooks) and presentation (components)**. This is the fundamental design principle that structures the entire application.

## Custom Hooks (Business Logic Layer)

Located in `hooks/` - Each hook manages a single concern:

### use-gemini-session.ts
WebSocket lifecycle, message parsing, token tracking, function call handling

**Responsibilities:**
- Fetch ephemeral token from backend API
- Establish WebSocket connection to Gemini Live
- Parse incoming server messages (multiple formats)
- Handle function calls automatically (send responses with matching IDs)
- Track token usage statistics
- Manage connection state (connected/disconnected)
- Error handling for connection issues

**Key exports:**
- `isConnected`: Connection state
- `connect()`: Establish session with optional greeting skip
- `disconnect()`: Close session and cleanup
- `sendAudio()`: Send base64 PCM audio to Gemini
- `sendGreeting()`: Trigger bartender greeting
- `error`: Connection/API errors
- `tokenUsage`: Real-time token consumption

### use-audio-capture.ts
Microphone access, AudioWorklet processing, 16kHz PCM conversion

**Responsibilities:**
- Request microphone permission from browser
- Set up AudioContext and AnalyserNode
- Load and initialize AudioWorklet for processing
- Resample audio from browser sample rate (48kHz) to 16kHz mono PCM
- Base64 encode audio chunks for transmission
- Provide volume analysis via AnalyserNode

**Key exports:**
- `isRecording`: Recording state
- `startRecording(callback)`: Start capture with audio chunk callback
- `stopRecording()`: Stop capture and cleanup
- `analyser`: AnalyserNode for volume visualization
- `error`: Microphone/AudioContext errors

### use-audio-playback.ts
Gapless audio playback, buffering strategy, 24kHz PCM decoding

**Responsibilities:**
- Initialize AudioContext for playback
- Decode base64 PCM to AudioBuffer
- Implement sophisticated buffering strategy for gapless playback
- Schedule audio chunks with precise timing
- Track playback state for UI indicators
- Handle emergency stop (interruptions)

**Buffering strategy:**
- Pre-buffer: Wait for 4 chunks (~400ms) before first play
- Look-ahead: Schedule 2-3 chunks in advance
- Re-buffer: Pause if queue drops below 3 chunks
- Timing: Use `AudioContext.currentTime` for precise scheduling

**Key exports:**
- `isPlayingAudio`: Playback state
- `initialize()`: Initialize AudioContext
- `play(base64Audio)`: Queue and play audio chunk
- `stop()`: Stop all audio and cleanup
- `emergencyStop()`: Immediately stop (for interruptions)

### use-volume-level.ts
Real-time volume visualization from AnalyserNode

**Responsibilities:**
- Analyze audio data from AnalyserNode
- Calculate RMS volume level
- Update volume state for UI visualization
- Efficient animation frame loop

**Key exports:**
- `volumeLevel`: 0-100 volume level for visualization

### use-vad.ts
Voice Activity Detection using @ricky0123/vad-react

**Responsibilities:**
- Initialize VAD model from CDN
- Detect speech start/end events
- Handle VAD errors gracefully (fallback to always-on)
- Configure sensitivity and timing parameters

**Configuration parameters:**
- `positiveSpeechThreshold`: 0.5 (higher = less sensitive)
- `negativeSpeechThreshold`: 0.3 (higher = stays active longer)
- `minSpeechMs`: 1000 (minimum speech duration)
- `preSpeechPadMs`: 1000 (pre-buffer duration)
- `redemptionMs`: 3000 (allows pauses between words)

**Key exports:**
- `isSpeechDetected`: Whether user is currently speaking
- `isVADLoading`: VAD initialization state
- `vadError`: VAD errors (null if working)
- `pauseVAD()`: Temporarily pause detection
- `resumeVAD()`: Resume detection

## Components (Presentation Layer)

Located in `components/voice-chat/`:

### voice-chat.tsx
Main orchestrator that coordinates all hooks (280 lines)

**Responsibilities:**
- Coordinate 5 custom hooks (session, capture, playback, volume, VAD)
- Manage component state (showMenu, isInitializing, sessionEnded, isClosing)
- Implement auto-initialization flow on page load
- Handle function calls from Gemini (show_menu, hide_menu, close_session)
- Manage VAD filter for audio processing
- Implement interruption detection logic
- Coordinate session lifecycle

**Does NOT contain:**
- Audio processing logic → delegated to hooks
- WebSocket management → delegated to use-gemini-session
- Buffering strategy → delegated to use-audio-playback

### Other Components (Pure Presentation)
- **barista-image.tsx** - Character image with voice indicator overlay
- **voice-indicator.tsx** - Animated audio visualization (60 circular bars)
- **menu-card.tsx** - Drink menu display
- **token-usage-display.tsx** - Token stats display
- **volume-bar.tsx** - Volume visualization bar
- **error-alert.tsx** - Error message display

**Key Principle:** Components should NEVER contain business logic. All state management, API calls, audio processing, and side effects belong in hooks.

## Session Lifecycle

### States

1. **isInitializing** - Auto-initialization in progress (page load only)
   - Fetching ephemeral token
   - Connecting to Gemini WebSocket
   - Initializing AudioContext
   - Starting microphone
   - Sending greeting trigger

2. **isConnected** - Active Gemini session
   - WebSocket open and ready
   - Audio streaming bidirectionally
   - Function calls being handled
   - Token usage being tracked

3. **isClosing** - close_session function called, waiting for farewell audio
   - 6 second delay for bartender farewell message
   - Menu hidden
   - No new audio sent
   - Waiting for cleanup

4. **sessionEnded** - Session closed, showing "Go to bar" button
   - All resources cleaned up
   - WebSocket closed
   - Audio stopped
   - Ready for new session

### Session End Triggers

1. **User-initiated (immediate):**
   - User clicks "Finish your order"
   - Calls `handleDisconnect()`
   - Immediate cleanup (no farewell)

2. **AI-initiated (delayed):**
   - Gemini calls `close_session` function
   - Sets `isClosing` state
   - Waits 6 seconds for farewell audio
   - Then calls `handleDisconnect()`

## Auto-Initialization Flow

**Location:** `components/voice-chat/voice-chat.tsx:108-151`

**Timing:** ~500ms total (optimized with parallel operations)

**Steps:**

1. **Connect to Gemini** (skipGreeting=true)
   - Fetch ephemeral token from `/api/gemini/token`
   - Initialize GoogleGenAI SDK with token
   - Establish WebSocket connection
   - Wait for `onopen` callback

2. **Initialize AudioContext**
   - Create AudioContext for playback
   - Requires user gesture (handled automatically)
   - Set up audio destination

3. **Start Microphone Recording**
   - Request microphone permission
   - Load AudioWorklet processor
   - Start recording with VAD filter callback
   - Audio chunks flow through VADFilter → sendAudio()

4. **Send Greeting Trigger**
   - Send empty text with `turnComplete: true`
   - Forces bartender to speak first
   - Triggers character greeting

**Why separate greeting?** This allows AudioContext to initialize before audio playback starts, preventing the first audio chunk from being delayed.

## Data Flow

```
User speaks → Microphone
  ↓
AudioContext (48kHz) → AudioWorklet (16kHz PCM)
  ↓
VADFilter (circular buffer + speech detection)
  ↓
use-gemini-session.sendAudio() → WebSocket
  ↓
Gemini Live API (processes audio + function calls)
  ↓
WebSocket → use-gemini-session.handleMessage()
  ↓
├─ Audio data → use-audio-playback.play()
│    ↓
│  AudioContext → Speakers
│
├─ Function calls → voice-chat.onFunctionCall()
│    ↓
│  UI state update (setShowMenu, setIsClosing, etc.)
│
└─ Token usage → setTokenUsage()
     ↓
   token-usage-display component
```

## Key Design Decisions

### Why Hooks for Business Logic?

1. **Reusability** - Audio capture/playback can be reused in other components
2. **Testability** - Hooks can be tested independently of UI
3. **Separation of Concerns** - Each hook has a single responsibility
4. **Composability** - voice-chat.tsx composes 5 hooks cleanly
5. **Performance** - useCallback/useMemo optimize audio processing

### Why Orchestrator Pattern?

The `voice-chat.tsx` component acts as an orchestrator that:
- Doesn't implement business logic itself
- Coordinates communication between hooks
- Translates hook data into UI state
- Handles cross-cutting concerns (interruption detection)

This prevents:
- Duplicated logic across components
- Tight coupling between UI and business logic
- Prop drilling through multiple levels
- State management complexity

### Why VAD Filter as Separate Class?

The `VADFilter` class (not a hook) because:
- Stateful object with circular buffer
- Needs to persist between renders
- Managed via useRef (vadFilterRef)
- Not a React lifecycle concern

## File Organization

```
hooks/                      # Business logic (5 hooks)
  ├── use-gemini-session.ts # WebSocket + message parsing
  ├── use-audio-capture.ts  # Mic → 16kHz PCM
  ├── use-audio-playback.ts # 24kHz PCM → Speakers
  ├── use-volume-level.ts   # Volume visualization
  └── use-vad.ts            # Speech detection

components/voice-chat/      # Presentation (7 components)
  ├── voice-chat.tsx        # Orchestrator (280 lines)
  ├── barista-image.tsx     # Character display
  ├── voice-indicator.tsx   # Audio animation
  ├── menu-card.tsx         # Drink menu
  ├── token-usage-display.tsx # Token stats
  ├── volume-bar.tsx        # Volume viz
  └── error-alert.tsx       # Error display

lib/                        # Utilities
  ├── audio/                # Audio utilities
  │   ├── capture.ts        # AudioWorklet setup
  │   ├── playback.ts       # Buffering logic
  │   └── vad-filter.ts     # VAD filtering class
  ├── gemini-utils.ts       # Message parsing
  └── types.ts              # TypeScript interfaces
```

This structure makes it immediately clear:
- Where to find business logic (hooks/)
- Where to find UI (components/)
- Where to find shared utilities (lib/)
