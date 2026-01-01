# Voice Activity Detection (VAD) System

## Architecture: Server-Side VAD Only

The application uses **Gemini's built-in server-side VAD** for all speech detection and turn-taking.

**No client-side VAD** - This simplifies the architecture, reduces page load time, and relies on Gemini's proven VAD system.

## Server-Side VAD (Gemini Built-in)

### Configuration

**Location:** `app/api/gemini/token/route.ts:42-49`

**Embedded in ephemeral token:**

```typescript
realtimeInputConfig: {
    automaticActivityDetection: {
        disabled: false,                                      // Enable server-side VAD
        startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',  // Detect speech quickly, filter noise
        silenceDurationMs: 200,                               // 200ms silence before turn complete
        prefixPaddingMs: 100                                  // Capture 100ms before speech start
    }
}
```

### How It Works

```
User audio stream → Gemini Live API (all chunks sent)
  ↓
Server-side VAD detects speech start
  ↓ (wait for complete utterance)
Server-side VAD detects 200ms silence
  ↓
Model processes complete utterance
  ↓
Model generates audio response
```

### Parameters

#### startOfSpeechSensitivity

**Options:** `START_SENSITIVITY_LOW`, `START_SENSITIVITY_MEDIUM`, `START_SENSITIVITY_HIGH`

**Current:** `START_SENSITIVITY_HIGH`

**Effect:**
- `HIGH`: Detects speech quickly, filters background noise effectively
- `MEDIUM`: Balanced detection
- `LOW`: Waits for clear speech, may miss soft starts or pick up noise

**Why HIGH?** Optimizes for responsiveness AND background noise rejection in voice chat.

#### silenceDurationMs

**Current:** 200ms

**Effect:** How long to wait for silence before considering turn complete.

**Trade-offs:**
- Shorter (100ms): Faster response, may cut off mid-sentence
- Longer (500ms): Waits for natural pauses, slower response

**Why 200ms?** Balances natural speech pauses with responsiveness for real-time conversation.

#### prefixPaddingMs

**Current:** 100ms

**Effect:** Captures N milliseconds of audio BEFORE speech detection.

**Why needed?** VAD takes ~100-200ms to detect speech start. Prefix padding ensures the first syllable isn't cut off.

**Example:**
```
Timeline: [silence] "Hello there"
                    ↑ VAD detects here (200ms late)
Without padding:    "ello there" ❌
With 100ms padding: "Hello there" ✅
```

### Advantages of Server-Side Only

1. **Simpler architecture** - One VAD system instead of two
2. **Faster page load** - No client-side VAD model to download (~5MB)
3. **Proven reliability** - Gemini's VAD is battle-tested at scale
4. **Lower latency** - No client-side processing overhead
5. **Maintainability** - Fewer dependencies, less code

## Interruption Detection

**Location:** `components/voice-chat/voice-chat.tsx:30-45`

**Implementation:** Volume-based detection

```typescript
const INTERRUPTION_VOLUME_THRESHOLD = 22; // Volume level (0-100)

// User is speaking if volume is above threshold
const isUserSpeaking = volumeLevel.volumeLevel > INTERRUPTION_VOLUME_THRESHOLD;

// If both user and bartender are speaking, interrupt the bartender
if (isUserSpeaking && audioPlayback.isPlayingAudio) {
    audioPlayback.emergencyStop();
}
```

### How It Works

1. **AnalyserNode** monitors microphone input continuously
2. **RMS volume** calculated 60 times per second (requestAnimationFrame)
3. **Threshold check** - if volume > 22, user is considered speaking
4. **Emergency stop** - immediately stops bartender audio

### Threshold Tuning

**Current:** 22 (out of 100)

**Effect:**
- Lower (15): More sensitive, interrupts on quiet speech (risk: false interruptions)
- Higher (30): Less sensitive, requires louder speech (risk: delayed interruptions)

**Typical values:**
- Background noise: 5-10
- Normal speech: 15-30
- Loud speech: 30-50

### Limitations

**Volume-only detection** means:
- Background music/TV might trigger false interruptions
- User should use headphones (already recommended for echo prevention)

**Trade-off:** Simpler code and faster load time vs. slightly less accurate interruption detection.

## Audio Flow

```
Microphone (getUserMedia)
  ↓ (48kHz stereo)
AudioContext → AnalyserNode (volume analysis)
  ↓
AudioWorklet
  ↓ Resample to 16kHz mono PCM
  ↓ Base64 encode
Main Thread
  ↓ ALL CHUNKS SENT (no filtering)
WebSocket → Gemini Live API
  ↓ Server-side VAD processes
Response audio (24kHz PCM)
  ↓
AudioContext → Speakers
```

**Key point:** ALL audio chunks are sent to Gemini. No client-side filtering means:
- Continuous audio stream (no gaps)
- Server VAD handles all speech detection
- Simpler audio pipeline

## Performance

### Network Usage

**Upload:** ~32KB/sec (continuous audio stream at 16kHz)
- No compression (all chunks sent)
- Consistent bandwidth usage

**Download:** Variable (depends on response length)
- ~48KB/sec during bartender speech (24kHz audio)

### CPU Usage

**Client-side:**
- AudioWorklet: ~1% (dedicated audio thread)
- AnalyserNode: ~1% (volume calculation)
- **Total:** ~2% CPU

**No VAD model** = No client-side ML processing

### Memory Usage

**Total:** ~1MB
- AudioBuffers for playback: ~500KB
- AudioContext state: ~500KB

**No VAD model** = No 5MB ONNX model in memory

## Troubleshooting

### Gemini Not Responding

**Symptoms:** User speaks but no response

**Causes:**
1. Audio not being sent (check WebSocket in DevTools)
2. Server VAD too sensitive (detecting noise as continuous speech)
3. silenceDurationMs too short (cutting off speech)

**Solutions:**
1. Check console for audio chunk logs
2. Lower startOfSpeechSensitivity to MEDIUM
3. Increase silenceDurationMs to 300-500ms

### False Interruptions

**Symptoms:** Bartender stops when user didn't speak

**Causes:**
1. INTERRUPTION_VOLUME_THRESHOLD too low
2. Background noise (music, TV, etc.)
3. Microphone too sensitive

**Solutions:**
1. Raise threshold from 22 to 25-30
2. Use headphones (eliminates speaker feedback)
3. Lower microphone sensitivity in OS settings

### Speech Starts Cut Off

**Symptoms:** First syllable missing from speech

**Causes:**
1. prefixPaddingMs too short or missing
2. Server VAD detection lag

**Solutions:**
1. Increase prefixPaddingMs from 100ms to 150-200ms
2. Ensure prefixPaddingMs is uncommented in token config

## Best Practices

### For Real-Time Conversation

**Current configuration is optimized for:**
- Fast responses (200ms silence detection)
- Background noise rejection (HIGH sensitivity)
- Natural conversation flow (prefix padding)

**Don't change unless you have specific issues.**

### For Quiet Speakers

If users speak softly and responses are cut off:

```typescript
// Increase silence duration
silenceDurationMs: 400  // From 200ms

// Lower interruption threshold
INTERRUPTION_VOLUME_THRESHOLD: 18  // From 22
```

### For Noisy Environments

If background noise triggers false speech detection:

```typescript
// Keep HIGH sensitivity (filters noise)
startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH'

// Raise interruption threshold
INTERRUPTION_VOLUME_THRESHOLD: 28  // From 22

// Recommend headphones to users
```

## Comparison: Previous Dual-VAD System

### What Was Removed

The previous system had:
1. **Client-side VAD** (@ricky0123/vad-react)
   - 5MB ONNX model downloaded from CDN
   - Silero VAD for speech detection
   - VADFilter for chunk filtering (70-90% token savings)

2. **Dual VAD coordination**
   - Client VAD filtered chunks before sending
   - Server VAD handled turn-taking
   - Complex state synchronization

### Why It Was Removed

**Problems:**
1. **91% of chunks were dropped** - Too aggressive filtering
2. **Speech fragmentation** - VAD would segment continuous speech into multiple parts
3. **Turn-taking confusion** - Gemini received: [speech] [gap] [speech] [gap]
4. **Added complexity** - Two VAD systems to configure and debug
5. **Slower page load** - 5MB model + 500ms initialization time

**Result:** More reliable to send all audio and let Gemini's proven server-side VAD handle everything.

## Migration Notes

If you previously used client-side VAD:

**Files removed:**
- `hooks/use-vad.ts`
- `lib/audio/vad-filter.ts`

**Dependencies removed:**
- `@ricky0123/vad-react`

**Changes to voice-chat.tsx:**
- Removed `useVAD` hook
- Removed `VADFilter` ref
- Simplified interruption detection (volume-only)
- Direct audio stream to Gemini (no filtering)

**Configuration changes:**
- `INTERRUPTION_VOLUME_THRESHOLD`: 15 → 22 (reduced false positives)
- No client-side VAD configuration needed

**Benefits:**
- Faster page load (~1 second faster)
- Simpler codebase (~200 lines removed)
- More reliable turn-taking
- Easier to debug
