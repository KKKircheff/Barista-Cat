# Audio Processing Patterns

This file is automatically loaded when working with files matching `lib/audio/**/*.ts`.

## Critical Sample Rate Requirements

### Input: 16kHz Mono PCM

**Gemini Live API requirement:** Audio input MUST be 16kHz.

**Source:** Browser microphone typically captures at 48kHz (or 44.1kHz on macOS).

**Conversion required:** Downsample from 48kHz → 16kHz (3:1 ratio).

**Location:** `public/audio-processor.worklet.js` (AudioWorklet)

**Pattern:**

```javascript
// In AudioWorklet process() method
const inputSampleRate = 48000;  // Typical browser rate
const outputSampleRate = 16000; // Gemini requirement
const ratio = inputSampleRate / outputSampleRate;  // 3.0

// Downsample: Take every 3rd sample
for (let i = 0; i < inputSamples.length; i += ratio) {
  output16kHz[outputIndex++] = inputSamples[Math.floor(i)];
}
```

**Important:** Ratio calculation must be dynamic based on actual input sample rate:

```javascript
// ✅ Good: Dynamic ratio
const ratio = sampleRate / 16000;  // sampleRate from AudioWorklet context

// ❌ Bad: Hardcoded ratio
const ratio = 3.0;  // Breaks if input is 44.1kHz!
```

### Output: 24kHz Mono PCM

**Gemini Live API output:** Audio output is 24kHz.

**Target:** Browser speakers (any rate, AudioContext handles resampling).

**No conversion needed:** Create AudioBuffer directly at 24kHz.

**Pattern:**

```typescript
const audioBuffer = audioContext.createBuffer(
  1,                    // Channels: 1 (mono)
  float32Array.length,  // Length in samples
  24000                 // Sample rate: 24kHz (CRITICAL: must match Gemini output)
);
```

**Common mistake:** Creating buffer at wrong sample rate:

```typescript
// ❌ Bad: Using browser's default rate
const audioBuffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
// Result: Audio plays at wrong speed (too fast or slow)

// ✅ Good: Explicit 24kHz
const audioBuffer = audioContext.createBuffer(1, length, 24000);
```

## PCM Format Details

### Int16 vs Float32

**Gemini API uses Int16:**
- Range: -32768 to 32767
- 16 bits per sample
- Base64 encoded for transmission

**Web Audio API uses Float32:**
- Range: -1.0 to 1.0
- 32 bits per sample
- Native AudioBuffer format

**Conversion required both directions:**

```typescript
// Int16 → Float32 (receiving from Gemini)
const float32Array = new Float32Array(int16Array.length);
for (let i = 0; i < int16Array.length; i++) {
  float32Array[i] = int16Array[i] / 32768.0;  // Normalize to -1.0 to 1.0
}

// Float32 → Int16 (sending to Gemini)
const int16Array = new Int16Array(float32Array.length);
for (let i = 0; i < float32Array.length; i++) {
  // Clamp and convert
  const clamped = Math.max(-1.0, Math.min(1.0, float32Array[i]));
  int16Array[i] = Math.round(clamped * 32767);
}
```

**Performance note:** These loops are hot paths. Consider using TypedArray methods if available.

## Gapless Playback Implementation

### Buffer Management

**Goal:** Play audio chunks without audible gaps between them.

**Challenge:** Chunks arrive over network with variable timing.

**Solution:** Pre-buffer + look-ahead scheduling + precise timing.

### Pre-Buffer Strategy

**Pattern:**

```typescript
const PRE_BUFFER_CHUNKS = 4;  // ~400ms at 100ms/chunk

if (state === 'BUFFERING') {
  audioQueue.push(chunk);

  if (audioQueue.length >= PRE_BUFFER_CHUNKS) {
    state = 'PLAYING';
    scheduleAllBufferedChunks();
  } else {
    // Wait for more chunks, don't play yet
    return;
  }
}
```

**Why 4 chunks?**
- Trade-off between latency (lower = faster) and smoothness (higher = fewer gaps)
- ~400ms is imperceptible to users but provides safety buffer
- Network jitter up to 200ms is common

**Tuning:**
- Reduce to 2-3 for lower latency (risk: more gaps)
- Increase to 5-6 for unstable networks (trade-off: higher latency)

### Look-Ahead Scheduling

**Problem:** If we schedule one chunk at a time, network delays cause gaps.

**Solution:** Schedule multiple chunks in advance.

**Pattern:**

```typescript
const LOOK_AHEAD_CHUNKS = 2;

const scheduleQueuedChunks = () => {
  let scheduledCount = 0;

  while (audioQueue.length > 0 && scheduledCount < LOOK_AHEAD_CHUNKS) {
    const chunk = audioQueue.shift();
    scheduleChunk(chunk);  // Schedule with precise timing
    scheduledCount++;
  }
};
```

**Effect:** Even if next chunk is delayed, we have 1-2 chunks already scheduled playing.

### Precise Timing with AudioContext.currentTime

**CRITICAL:** Never use setTimeout for audio scheduling. Use AudioContext.currentTime.

**Pattern:**

```typescript
// ✅ Good: Hardware-precise timing
const scheduleChunk = (audioBuffer: AudioBuffer) => {
  const source = audioContext.createBufferSourceNode();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  // Calculate exact start time
  const currentTime = audioContext.currentTime;

  if (!nextScheduledTime || nextScheduledTime < currentTime) {
    // First chunk or recovering from gap
    nextScheduledTime = currentTime + 0.1;  // Small safety margin
  }

  // Schedule start
  source.start(nextScheduledTime);

  // Update next time (exactly when this chunk ends)
  nextScheduledTime += audioBuffer.duration;

  // Track playback
  source.onended = () => {
    currentlyPlayingSources.delete(source);
  };

  currentlyPlayingSources.add(source);
};
```

**Why this works:**
- `AudioContext.currentTime` is hardware clock (microsecond precision)
- `audioBuffer.duration` is exact sample count / sample rate
- Cumulative timing ensures no drift

**❌ Don't use:**

```typescript
// ❌ Bad: setTimeout is not precise enough for audio
setTimeout(() => {
  source.start();  // May be off by 10-50ms
}, delay);
```

### Re-Buffering on Network Hiccup

**Pattern:**

```typescript
const MIN_BUFFER_CHUNKS = 3;

const play = async (base64Audio: string) => {
  const audioBuffer = await decodeAudio(base64Audio);
  audioQueue.push(audioBuffer);

  // Check if we need to re-buffer
  if (state === 'PLAYING' && audioQueue.length < MIN_BUFFER_CHUNKS) {
    state = 'RE_BUFFERING';
    console.log('Re-buffering - queue running low');
    return;  // Pause scheduling
  }

  // Resume if buffer refilled
  if (state === 'RE_BUFFERING' && audioQueue.length >= MIN_BUFFER_CHUNKS) {
    state = 'PLAYING';
    scheduleQueuedChunks();
  }

  // Normal playback
  if (state === 'PLAYING') {
    scheduleQueuedChunks();
  }
};
```

**Effect:** Brief pause during network issues instead of garbled/stuttering audio.

## AudioWorklet Best Practices

### Why AudioWorklet?

**Advantages over ScriptProcessorNode (deprecated):**
- Runs on dedicated audio thread (not main thread)
- No main thread blocking from UI updates
- Lower latency
- Better performance

**Pattern:**

```typescript
// 1. Load worklet module
await audioContext.audioWorklet.addModule('/audio-processor.worklet.js');

// 2. Create processor node
const workletNode = new AudioWorkletNode(audioContext, 'audio-processor', {
  processorOptions: {
    targetSampleRate: 16000  // Custom option passed to worklet
  }
});

// 3. Connect audio graph
microphone → workletNode → audioContext.destination

// 4. Listen for processed data
workletNode.port.onmessage = (event) => {
  const base64Audio = event.data.audio;
  onAudioData(base64Audio);
};
```

### Worklet Quantum Size

**Fixed:** 128 samples per process() call.

**At 48kHz:** 128 samples = ~2.67ms

**At 16kHz output:** ~40ms chunks (after downsampling and batching)

**Pattern in worklet:**

```javascript
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0][0];  // First input, first channel

    // Process exactly 128 samples each call
    // Batch multiple calls into ~40ms chunks before sending to main thread
    // (Reduces message overhead)

    return true;  // Keep processor alive
  }
}
```

### Memory Management

**AudioBuffers are large:**
- 100ms at 24kHz = 2400 samples = 9.6KB (Float32)
- Queue of 6 chunks = ~58KB

**Cleanup pattern:**

```typescript
// Auto-cleanup via onended
source.onended = () => {
  this.currentlyPlayingSources.delete(source);
  // Source auto-garbage-collected after onended
};

// Manual cleanup
const stop = () => {
  // Stop all sources
  this.currentlyPlayingSources.forEach(source => {
    try {
      source.stop();
    } catch (e) {
      // Ignore if already stopped
    }
  });
  this.currentlyPlayingSources.clear();

  // Clear queue
  this.audioQueue = [];
};
```

## Volume Analysis

### AnalyserNode Pattern

**Purpose:** Real-time volume visualization and interruption detection.

**Pattern:**

```typescript
// Setup
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;  // Small = fast analysis
analyser.smoothingTimeConstant = 0.8;  // Smooth volume changes

microphone.connect(analyser);  // Tap into audio stream

// Update volume (in requestAnimationFrame loop)
const dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(dataArray);

// Calculate RMS (Root Mean Square) volume
const sum = dataArray.reduce((acc, val) => acc + val * val, 0);
const rms = Math.sqrt(sum / dataArray.length);
const volumeLevel = (rms / 255) * 100;  // 0-100 scale
```

### fftSize Selection

**Options:** 32, 64, 128, 256, 512, 1024, 2048, ...

**Current:** 256

**Trade-offs:**
- Smaller (128): Faster, less accurate
- Larger (512): Slower, more accurate

**For volume visualization:** 256 is ideal (fast enough for 60 FPS, accurate enough).

### Update Frequency

**Pattern:**

```typescript
useEffect(() => {
  if (!analyser || !isRecording) return;

  const updateVolume = () => {
    const level = calculateVolume(analyser);
    setVolumeLevel(level);
    rafId = requestAnimationFrame(updateVolume);  // ~60 FPS
  };

  let rafId = requestAnimationFrame(updateVolume);

  return () => {
    cancelAnimationFrame(rafId);  // Cleanup
  };
}, [analyser, isRecording]);
```

**Why requestAnimationFrame?**
- Synced with display refresh (60 FPS)
- Pauses when tab not visible (saves CPU)
- Better than setInterval for UI updates

## Emergency Stop (Interruptions)

### Pattern

**Use case:** User starts speaking, immediately stop bartender audio.

**Pattern:**

```typescript
const emergencyStop = () => {
  // 1. Stop all currently playing sources IMMEDIATELY
  this.currentlyPlayingSources.forEach(source => {
    try {
      source.stop();  // Stop() has ~1ms latency
    } catch (e) {
      // Ignore if already stopped
    }
  });
  this.currentlyPlayingSources.clear();

  // 2. Clear queue (discard unplayed audio)
  this.audioQueue = [];

  // 3. Reset state
  this.state = 'IDLE';
  this.nextScheduledTime = null;
  this.isPlayingAudio = false;
};
```

**Latency:** ~1-5ms (imperceptible)

**Effect:** Instant silence, no fade-out.

## Base64 Encoding/Decoding

### Encoding (Float32 → Base64)

**Pattern:**

```typescript
// 1. Float32 → Int16
const int16Array = new Int16Array(float32Array.length);
for (let i = 0; i < float32Array.length; i++) {
  int16Array[i] = Math.max(-32768, Math.min(32767, float32Array[i] * 32768));
}

// 2. Int16 → Uint8 (bytes)
const bytes = new Uint8Array(int16Array.buffer);

// 3. Uint8 → Base64
const base64 = btoa(String.fromCharCode(...bytes));
```

**Performance note:** Spread operator `...bytes` can be slow for large arrays. Consider chunking for >10KB.

### Decoding (Base64 → Float32)

**Pattern:**

```typescript
// 1. Base64 → binary string
const binaryString = atob(base64Audio);

// 2. Binary string → Uint8Array
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}

// 3. Uint8Array → Int16Array (reinterpret bytes)
const int16Array = new Int16Array(bytes.buffer);

// 4. Int16 → Float32
const float32Array = new Float32Array(int16Array.length);
for (let i = 0; i < int16Array.length; i++) {
  float32Array[i] = int16Array[i] / 32768.0;
}
```

## Performance Optimization

### Avoid Allocations in Hot Paths

**❌ Bad: Allocate every frame**

```typescript
const updateVolume = () => {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);  // Allocate!
  analyser.getByteFrequencyData(dataArray);
};
```

**✅ Good: Reuse buffer**

```typescript
const dataArray = new Uint8Array(analyser.frequencyBinCount);  // Allocate once

const updateVolume = () => {
  analyser.getByteFrequencyData(dataArray);  // Reuse buffer
};
```

### Batch Operations

**❌ Bad: Send every chunk immediately**

```typescript
// In AudioWorklet
process(inputs, outputs) {
  const chunk = processChunk(inputs[0][0]);  // 128 samples = ~2.6ms at 48kHz
  this.port.postMessage({ audio: chunk });   // 375 messages/second!
}
```

**✅ Good: Batch multiple chunks**

```typescript
// In AudioWorklet
process(inputs, outputs) {
  this.buffer.push(...inputs[0][0]);

  if (this.buffer.length >= TARGET_CHUNK_SIZE) {  // ~40ms worth
    const chunk = processChunk(this.buffer);
    this.port.postMessage({ audio: chunk });  // 25 messages/second
    this.buffer = [];
  }
}
```

## Common Audio Issues and Solutions

### Choppy Playback

**Symptoms:** Audio cuts out, robotic sound

**Causes:**
1. Buffer too small (gaps between chunks)
2. Network latency spikes
3. CPU overload (main thread blocking)

**Solutions:**
1. Increase PRE_BUFFER_CHUNKS from 4 to 6
2. Increase MIN_BUFFER_CHUNKS from 3 to 4
3. Move processing to AudioWorklet (already done)

### Audio Playing at Wrong Speed

**Symptoms:** Chipmunk voice or slow-motion voice

**Cause:** AudioBuffer created at wrong sample rate

**Solution:**

```typescript
// ✅ Verify sample rate matches data
const audioBuffer = audioContext.createBuffer(
  1,
  float32Array.length,
  24000  // MUST match Gemini output rate
);
```

### Silence/No Audio

**Symptoms:** No sound from speakers

**Causes:**
1. AudioContext suspended (requires user gesture)
2. Volume at 0
3. Wrong AudioContext state

**Solutions:**

```typescript
// 1. Check AudioContext state
console.log(audioContext.state);  // Should be 'running'

if (audioContext.state === 'suspended') {
  await audioContext.resume();  // Requires user gesture
}

// 2. Verify buffer has data
console.log(float32Array.some(v => v !== 0));  // Should be true

// 3. Check connections
source.connect(audioContext.destination);  // Must be connected
```

### Timing Drift

**Symptoms:** Audio gradually gets out of sync over time

**Cause:** Using Date.now() or performance.now() instead of AudioContext.currentTime

**Solution:**

```typescript
// ❌ Bad: System clock drifts
const startTime = Date.now() / 1000;

// ✅ Good: Audio clock is precise
const startTime = audioContext.currentTime;
```

## Testing Audio Pipeline

### Unit Tests

```typescript
test('downsample 48kHz to 16kHz', () => {
  const input = new Float32Array(480);  // 10ms at 48kHz
  const output = downsample(input, 48000, 16000);

  expect(output.length).toBe(160);  // 10ms at 16kHz
});

test('Int16 to Float32 conversion', () => {
  const int16 = new Int16Array([32767, 0, -32768]);
  const float32 = int16ToFloat32(int16);

  expect(float32[0]).toBeCloseTo(1.0);
  expect(float32[1]).toBe(0);
  expect(float32[2]).toBeCloseTo(-1.0);
});
```

### Integration Tests

```typescript
test('gapless playback schedules correctly', async () => {
  const playback = new AudioPlayback(24000);
  await playback.initialize();

  // Send 10 chunks rapidly
  for (let i = 0; i < 10; i++) {
    await playback.play(generateTestChunk());
  }

  // Verify timing is cumulative (no gaps)
  expect(playback.nextScheduledTime).toBeCloseTo(
    audioContext.currentTime + (10 * 0.1),  // 10 chunks × 100ms each
    1  // 1 second tolerance
  );
});
```
