# Audio Pipeline

## Overview

The audio pipeline handles bidirectional streaming:
- **Microphone → Gemini**: 16kHz mono PCM
- **Gemini → Speakers**: 24kHz mono PCM

Both pipelines use base64 encoding for transmission over WebSocket.

## Microphone → Gemini (16kHz PCM)

### Pipeline Flow

```
Browser Microphone (getUserMedia)
  ↓ (typically 48kHz stereo)
AudioContext
  ↓
AudioWorklet (audio-processor.worklet.js)
  ↓ Resample to 16kHz mono
  ↓ Convert to PCM Int16Array
  ↓ Base64 encode
AudioWorklet → Main Thread (postMessage)
  ↓
use-audio-capture.ts (onAudioData callback)
  ↓
VADFilter.processChunk() (optional filtering)
  ↓
use-gemini-session.sendAudio()
  ↓
WebSocket → Gemini Live API
```

### Sample Rate Conversion

**Why 16kHz?** Gemini Live API accepts 16kHz PCM input. Browser typically captures at 48kHz.

**Conversion process** (in AudioWorklet):

```javascript
// 1. Get input samples (48kHz)
const inputSamples = inputs[0][0];  // First channel

// 2. Downsample to 16kHz (3:1 ratio for 48kHz input)
const ratio = sampleRate / 16000;   // ~3.0 for 48kHz
for (let i = 0; i < inputSamples.length; i += ratio) {
  output16kHz[outputIndex++] = inputSamples[Math.floor(i)];
}

// 3. Convert Float32 to Int16
for (let i = 0; i < output16kHz.length; i++) {
  int16Array[i] = Math.max(-32768, Math.min(32767, output16kHz[i] * 32768));
}

// 4. Base64 encode
const base64 = btoa(String.fromCharCode(...new Uint8Array(int16Array.buffer)));
```

### AudioWorklet Implementation

**File:** `public/audio-processor.worklet.js`

**Why AudioWorklet?**
- Runs on separate audio thread (not main thread)
- Prevents audio glitches from UI updates
- Low-latency processing (128 samples per callback)
- Direct access to raw audio samples

**Worklet setup:**

```typescript
// 1. Load worklet
await audioContext.audioWorklet.addModule('/audio-processor.worklet.js');

// 2. Create processor node
const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');

// 3. Connect pipeline
microphone → workletNode → audioContext.destination

// 4. Listen for processed audio
workletNode.port.onmessage = (event) => {
  const base64Audio = event.data.audio;
  onAudioData(base64Audio);  // Send to Gemini
};
```

### Chunk Size

**Input:** 128 samples (AudioWorklet quantum size)
**Output:** ~40ms chunks at 16kHz (~640 samples)

**Why 40ms chunks?** Balance between:
- Latency (smaller = faster response)
- Network efficiency (larger = fewer messages)
- API limits (Gemini has max message size)

### Volume Analysis

**AnalyserNode** provides real-time volume visualization:

```typescript
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;  // Fast analysis
microphone.connect(analyser);

// Get volume level
const dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(dataArray);

// Calculate RMS volume
const sum = dataArray.reduce((acc, val) => acc + val * val, 0);
const rms = Math.sqrt(sum / dataArray.length);
const volumeLevel = (rms / 255) * 100;  // 0-100 scale
```

**Used for:**
- Volume bar visualization
- Interruption detection (threshold: 15)

## Gemini → Speakers (24kHz PCM)

### Pipeline Flow

```
WebSocket message from Gemini
  ↓ (base64 24kHz PCM)
use-gemini-session.handleMessage()
  ↓ Extract audioData
use-audio-playback.play(base64Audio)
  ↓ Decode base64 → Int16Array
  ↓ Convert Int16 → Float32
  ↓ Create AudioBuffer
  ↓ Create AudioBufferSourceNode
  ↓ Schedule with precise timing
AudioContext → Speakers
```

### Sample Rate (24kHz)

**Why 24kHz?** Gemini Live API outputs 24kHz PCM. Higher quality than input (16kHz).

**No conversion needed** - Create AudioBuffer directly at 24kHz:

```typescript
const audioBuffer = audioContext.createBuffer(
  1,              // Mono
  float32Array.length,
  24000           // 24kHz sample rate
);
audioBuffer.getChannelData(0).set(float32Array);
```

### Decoding Process

```typescript
// 1. Base64 → ArrayBuffer
const binaryString = atob(base64Audio);
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}

// 2. ArrayBuffer → Int16Array
const int16Array = new Int16Array(bytes.buffer);

// 3. Int16 → Float32 (normalize to -1.0 to 1.0)
const float32Array = new Float32Array(int16Array.length);
for (let i = 0; i < int16Array.length; i++) {
  float32Array[i] = int16Array[i] / 32768.0;  // Normalize
}
```

### Gapless Playback Strategy

**Goal:** No audible gaps between audio chunks, smooth continuous playback.

**File:** `lib/audio/playback.ts`

#### Buffering Parameters

```typescript
const PRE_BUFFER_CHUNKS = 4;      // Wait for 4 chunks before playing (~400ms)
const MIN_BUFFER_CHUNKS = 3;      // Re-buffer if queue drops below 3
const LOOK_AHEAD_CHUNKS = 2;      // Schedule 2-3 chunks in advance
```

#### State Machine

```
IDLE
  ↓ (first chunk arrives)
BUFFERING (wait for PRE_BUFFER_CHUNKS)
  ↓ (buffer full)
PLAYING (schedule chunks with precise timing)
  ↓ (queue drops below MIN_BUFFER_CHUNKS)
RE_BUFFERING (pause, wait for more chunks)
  ↓ (queue refilled)
PLAYING (resume)
```

#### Scheduling Algorithm

**Key insight:** Use `AudioContext.currentTime` for precise scheduling.

```typescript
// 1. Calculate start time
if (!this.nextScheduledTime || this.nextScheduledTime < currentTime) {
  // First chunk or recovering from gap
  this.nextScheduledTime = currentTime + 0.1;  // Small delay for safety
}

// 2. Create and schedule source node
const source = audioContext.createBufferSource();
source.buffer = audioBuffer;
source.connect(audioContext.destination);
source.start(this.nextScheduledTime);

// 3. Update next scheduled time
this.nextScheduledTime += audioBuffer.duration;  // Exactly when this chunk ends

// 4. Track when playback ends
source.onended = () => {
  this.currentlyPlayingSources.delete(source);
  if (this.currentlyPlayingSources.size === 0) {
    this.isPlayingAudio = false;  // Update UI indicator
  }
};
```

**Why this works:**
- `AudioContext.currentTime` is hardware clock (precise)
- Scheduling in advance prevents gaps
- Cumulative duration calculation ensures perfect alignment

#### Look-Ahead Scheduling

**Problem:** If we wait for chunk to arrive before scheduling, there might be a gap.

**Solution:** Schedule 2-3 chunks ahead.

```typescript
// Schedule all buffered chunks (up to limit)
while (audioQueue.length > 0 && scheduledCount < LOOK_AHEAD_CHUNKS) {
  const chunk = audioQueue.shift();
  scheduleChunk(chunk);
  scheduledCount++;
}
```

**Effect:** Even if next chunk is delayed, we have 2-3 chunks already scheduled to cover the gap.

#### Pre-Buffering

**Problem:** First chunk arrives, we play immediately → next chunk delayed → gap.

**Solution:** Wait for 4 chunks (~400ms) before playing first time.

```typescript
if (state === 'BUFFERING') {
  if (audioQueue.length >= PRE_BUFFER_CHUNKS) {
    state = 'PLAYING';
    scheduleQueuedChunks();  // Start playing all buffered
  }
  return;  // Don't play yet
}
```

**Trade-off:** 400ms latency on first response, but smooth playback thereafter.

#### Re-Buffering

**Problem:** Network hiccup → queue empties → gap in audio.

**Solution:** Detect low queue, pause scheduling until refilled.

```typescript
if (state === 'PLAYING' && audioQueue.length < MIN_BUFFER_CHUNKS) {
  state = 'RE_BUFFERING';
  console.log('Re-buffering...');
}

if (state === 'RE_BUFFERING' && audioQueue.length >= MIN_BUFFER_CHUNKS) {
  state = 'PLAYING';
  scheduleQueuedChunks();  // Resume
}
```

**Effect:** Brief pause during network issues, but avoids garbled/stuttering audio.

### Emergency Stop (Interruptions)

**Use case:** User starts speaking while bartender is talking.

**Solution:** Immediately stop all audio.

```typescript
emergencyStop() {
  // 1. Stop all currently playing sources
  this.currentlyPlayingSources.forEach(source => {
    try {
      source.stop();
    } catch (e) {
      // Ignore if already stopped
    }
  });
  this.currentlyPlayingSources.clear();

  // 2. Clear queue
  this.audioQueue = [];

  // 3. Reset state
  this.state = 'IDLE';
  this.nextScheduledTime = null;
  this.isPlayingAudio = false;
}
```

**Triggered by:** `components/voice-chat/voice-chat.tsx:52` when interruption detected.

## Performance Considerations

### Memory Management

**AudioBuffers are large** (~24KB per 100ms at 24kHz).

**Cleanup strategy:**
- Source nodes auto-garbage-collected after `onended`
- Queue limited by re-buffering logic (max ~6 chunks)
- Clear queue on stop/emergency stop

### CPU Usage

**AudioWorklet** runs on dedicated audio thread:
- No impact on UI rendering
- No main thread blocking
- Fixed 128-sample quantum (low latency)

**AnalyserNode** optimized:
- `fftSize: 256` (fast, low CPU)
- `requestAnimationFrame` for volume updates (60 FPS max)

### Network Efficiency

**Chunk size optimization:**
- 40ms chunks at 16kHz input → ~640 samples → ~1.3KB base64
- 100ms chunks at 24kHz output → ~2400 samples → ~4.8KB base64

**Trade-offs:**
- Smaller chunks = lower latency, more messages
- Larger chunks = higher latency, fewer messages
- Current sizes balance latency (~40-100ms) with efficiency

## Common Audio Issues

### Choppy/Stuttering Playback

**Symptoms:** Audio cuts out, robotic sound, gaps

**Causes:**
1. Network latency spikes
2. Pre-buffer too small
3. Look-ahead not scheduling enough chunks

**Solutions:**
1. Increase `PRE_BUFFER_CHUNKS` from 4 to 6
2. Increase `MIN_BUFFER_CHUNKS` from 3 to 4
3. Check network latency (browser DevTools)

### Delayed Response

**Symptoms:** Long pause before bartender starts speaking

**Causes:**
1. Pre-buffer waiting for chunks
2. Network latency to Gemini API
3. Model processing time

**Solutions:**
1. Reduce `PRE_BUFFER_CHUNKS` from 4 to 2 (trade-off: more gaps)
2. Check Gemini API latency
3. Use faster model (already using 2.5 Flash)

### No Audio Playback

**Symptoms:** Silence, no sound from speakers

**Causes:**
1. AudioContext not initialized (requires user gesture)
2. AudioContext suspended
3. Incorrect sample rate

**Solutions:**
1. Ensure `audioPlayback.initialize()` called after user interaction
2. Check `audioContext.state === 'running'`
3. Verify buffer created with correct sample rate (24000)

### Echo/Feedback

**Symptoms:** Bartender's voice fed back into microphone

**Causes:**
1. Speakers playing into microphone
2. No echo cancellation

**Solutions:**
1. Use headphones (recommended)
2. Lower speaker volume
3. Enable browser echo cancellation (automatically enabled in getUserMedia)

### Interruption Not Working

**Symptoms:** User speaks but bartender continues

**Causes:**
1. VAD not detecting speech
2. Volume threshold too high
3. `emergencyStop()` not called

**Solutions:**
1. Check `vad.isSpeechDetected` state
2. Lower `INTERRUPTION_VOLUME_THRESHOLD` from 15 to 10
3. Verify interruption logic in `voice-chat.tsx:40-55`

## Audio Format Reference

### Input (Microphone → Gemini)

```
Format: PCM signed 16-bit little-endian
Sample Rate: 16000 Hz
Channels: 1 (mono)
Encoding: Base64
MIME Type: audio/pcm;rate=16000
Chunk Duration: ~40ms
Chunk Size: ~640 samples (~1.3KB base64)
```

### Output (Gemini → Speakers)

```
Format: PCM signed 16-bit little-endian
Sample Rate: 24000 Hz
Channels: 1 (mono)
Encoding: Base64
MIME Type: audio/pcm;rate=24000
Chunk Duration: ~100ms
Chunk Size: ~2400 samples (~4.8KB base64)
```

### Sample Rate Compatibility

| Source | Rate | Compatible? | Notes |
|--------|------|-------------|-------|
| Browser default | 48kHz | Yes | Downsampled to 16kHz |
| macOS | 44.1kHz | Yes | Downsampled to 16kHz |
| Windows | 48kHz | Yes | Downsampled to 16kHz |
| Gemini input | 16kHz | Native | No conversion |
| Gemini output | 24kHz | Native | No conversion |
| Speakers | Any | Yes | AudioContext resamples |

## Testing Audio Pipeline

### Test Microphone Input

```typescript
// 1. Check microphone permission
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => console.log('Microphone working'))
  .catch(err => console.error('Microphone error:', err));

// 2. Check AudioWorklet loading
audioContext.audioWorklet.addModule('/audio-processor.worklet.js')
  .then(() => console.log('AudioWorklet loaded'))
  .catch(err => console.error('AudioWorklet error:', err));

// 3. Check audio chunks
onAudioData callback should log base64 strings every ~40ms
```

### Test Audio Output

```typescript
// 1. Check AudioContext state
console.log(audioContext.state);  // Should be 'running'

// 2. Test playback with dummy data
const testAudio = generateTestTone(24000, 440, 1.0);  // 440Hz, 1 second
audioPlayback.play(testAudio);

// 3. Check scheduling
console.log(audioPlayback.nextScheduledTime);  // Should increment
console.log(audioPlayback.currentlyPlayingSources.size);  // Should be > 0
```

### Test Gapless Playback

```typescript
// Send multiple chunks rapidly
for (let i = 0; i < 10; i++) {
  audioPlayback.play(generateTestTone(24000, 440, 0.1));  // 10x 100ms chunks
}

// Listen for gaps (should be continuous 1-second tone)
```

### Test Interruption

```typescript
// 1. Start bartender audio
audioPlayback.play(longAudioClip);

// 2. Simulate user speaking
volumeLevel.volumeLevel = 20;  // Above threshold
vad.isSpeechDetected = true;

// 3. Verify emergency stop triggered
// Should see: "[VoiceChat] Interruption detected - stopping bartender audio"
```
