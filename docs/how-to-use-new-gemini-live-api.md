# How to Use Gemini Live API (December 2025)

This guide explains how the Barista-Cat app uses the new Gemini Live API with direct client-side WebSocket connections.

## Overview

The Gemini Live API enables real-time, bidirectional audio conversations with Gemini models using WebSocket connections. This app uses it to create a voice-based barista experience with the character "Whiskerjack," a sarcastic post-apocalyptic barista cat.

## Architecture

### Client-Side Direct Connection with Ephemeral Tokens
- **Direct WebSocket connection** from browser to Gemini Live API
- **Ephemeral token** fetched from backend endpoint (`/api/gemini/token`)
- No server-side proxy - minimal latency for real-time audio
- Session managed entirely by the `@google/genai` SDK in the browser
- All configuration (model, system instructions, tools, speech config) is embedded in the ephemeral token

### Key Architectural Difference: Token-Embedded Config

**Old Approach (API Key)**:
```typescript
// Client receives raw API key
const {token} = await fetch('/api/gemini/token')
const ai = new GoogleGenAI({apiKey: token})

// Client sends configuration
const session = await ai.live.connect({
  model: 'gemini-2.5-flash...',
  config: {
    systemInstruction: {...},  // ❌ Sent from client
    responseModalities: [...],
    speechConfig: {...},
    tools: [...]
  }
})
```

**New Approach (Ephemeral Token)**:
```typescript
// Server creates token with embedded config
const tokenResponse = await client.authTokens.create({
  config: {
    liveConnectConstraints: {
      model: 'gemini-2.5-flash...',
      config: {
        systemInstruction: {...},  // ✅ Embedded server-side
        responseModalities: [...],
        tools: [...]
      }
    }
  }
})

// Client receives ephemeral token and connects with minimal config
const {token} = await fetch('/api/gemini/token')
const ai = new GoogleGenAI({apiKey: token, httpOptions: {apiVersion: 'v1alpha'}})
const session = await ai.live.connect({
  model: GEMINI_MODELS.LIVE_FLASH_NATIVE
  // NO config object - everything is in the token!
})
```

**Benefits**:
- ✅ More secure - sensitive config never leaves server
- ✅ Simpler client code - no config duplication
- ✅ Easier to maintain - config in one place
- ✅ True ephemeral tokens - single-use, time-limited

### Security
- API key stored server-side in environment variables
- Token endpoint creates and returns **ephemeral token** (not raw API key)
- Ephemeral tokens expire after 30 minutes (token lifetime)
- New sessions must be created within 60 seconds of token generation
- Tokens are single-use (uses: 1)

### Audio Pipeline
- **Capture**: 16kHz PCM mono from microphone
- **Playback**: 24kHz PCM with gapless buffering
- **Transmission**: Real-time audio chunks via WebSocket

## Configuration

### Model
`gemini-2.5-flash-native-audio-preview-12-2025`

### Voice
**Iapetus** - Conversational, clear voice suitable for the barista character

### Response Settings
- **Response modalities**: `['AUDIO']` - Audio-only responses
- **System instruction**: Whiskerjack character personality (see `lib/system-instruction/format.ts`)
  - "You are 'Whiskerjack', a post-apocalyptic barista cat"
  - "Be sarcastic but charming"
  - "Keep responses under 30 words"
  - Initial greeting with max 30 words when conversation starts
  - Custom greeting triggered by client after connection

### Audio Settings
- **Input**: 16kHz PCM mono, automatic activity detection enabled
  - Start-of-speech sensitivity: `START_SENSITIVITY_LOW`
  - Silence duration: 200ms
- **Output**: 24kHz PCM, pre-buffering for smooth playback
- **Transmission**: Real-time chunks sent via `sendRealtimeInput()`

## Function Calling (Tools)

The app uses three tool functions to control UI and session behavior:

### 1. show_menu
**Purpose**: Display the cocktails/drinks menu to the user

**Description**:
"Show the cocktails and drinks menu to the user. Call this when user asks about drinks, menu, cocktails, or what beverages are available."

**Trigger phrases:**
- "What drinks do you have?"
- "Show me the menu"
- "What cocktails are available?"
- "What's on the menu?"

**Response**: UI displays `MenuCard` component under barista avatar

### 2. hide_menu
**Purpose**: Hide the menu from view

**Description**:
"Hide the cocktails menu from view. Call this when user is done looking at the menu, user ordered a drink or conversation moves on."

**Trigger phrases:**
- "That's enough"
- "Hide the menu"
- User ordered a drink
- User moves on to ordering

**Response**: UI hides the menu card

### 3. close_session
**Purpose**: End the conversation gracefully

**Description**:
"CRITICAL: ONLY call this when user explicitly wants to LEAVE the café or END their visit. Valid triggers: 'goodbye', 'bye', 'see you', 'gotta go', 'I'm leaving', 'time to go'. DO NOT call when user finishes ordering or says 'I'm done ordering' - they may want more drinks. After orders, ask if they want more or are ready to leave."

**Trigger phrases:**
- "Goodbye"
- "Bye"
- "See you"
- "Gotta go"
- "I'm leaving"
- "Time to go"

**IMPORTANT - Do NOT trigger on:**
- "I'm done ordering"
- "That's all" (for the order)
- User finishes placing an order

**Response**:
1. UI shows "Saying goodbye..." button
2. Barista finishes their farewell message (6-second delay)
3. Session disconnects automatically
4. UI resets to "Go to bar" button

**Important**: The UI waits 6 seconds after receiving the close_session function call to allow the barista to finish speaking before disconnecting.

### Function Call Flow

```
1. User speaks trigger phrase
2. Gemini sends toolCall message with function details
   {
     "toolCall": {
       "functionCalls": [{
         "id": "unique-id",
         "name": "show_menu",
         "args": {}
       }]
     }
   }
3. Client extracts function call from message
4. Client executes function (e.g., setShowMenu(true))
5. Client sends function response back to Gemini
   {
     "functionResponses": [{
       "id": "unique-id",  // MUST match the call ID
       "name": "show_menu",
       "response": {
         "success": true,
         "message": "Function show_menu executed"
       }
     }]
   }
6. Gemini acknowledges and continues conversation
```

**Critical**: Function responses MUST include the matching `id` field from the original function call. Without this, Gemini cannot associate the response with the call.

## Session Management

### Creating a Session

1. **Page loads or user clicks "Go to bar"**
   ```typescript
   await geminiSession.connect(skipGreeting)
   ```

2. **Fetch ephemeral token from backend**
   ```typescript
   const response = await fetch('/api/gemini/token', {method: 'POST'})
   const {token, expiresAt} = await response.json()
   ```
   Backend creates ephemeral token with full configuration embedded:
   ```typescript
   const tokenResponse = await client.authTokens.create({
     config: {
       uses: 1,
       expireTime: expireTimeISO,  // 30 minutes from now
       newSessionExpireTime: newSessionExpireISO,  // 60 seconds from now
       liveConnectConstraints: {
         model: 'gemini-2.5-flash-native-audio-preview-12-2025',
         config: {
           systemInstruction: {...},
           responseModalities: ['AUDIO'],
           realtimeInputConfig: {...},
           speechConfig: {...},
           tools: [...]
         }
       },
       httpOptions: {apiVersion: 'v1alpha'}  // REQUIRED
     }
   })
   ```

3. **Initialize GoogleGenAI SDK with ephemeral token**
   ```typescript
   const ai = new GoogleGenAI({
     apiKey: token,  // Ephemeral token
     httpOptions: {apiVersion: 'v1alpha'}  // REQUIRED
   })
   ```

4. **Connect to Gemini Live WebSocket with minimal config**
   ```typescript
   const session = await ai.live.connect({
     model: GEMINI_MODELS.LIVE_FLASH_NATIVE,
     // NO config - everything is in the ephemeral token!
     callbacks: {
       onopen: () => {...},
       onmessage: (msg) => {...},
       onerror: (err) => {...},
       onclose: (evt) => {...}
     }
   })
   ```

5. **Initialize audio and start microphone**
   - AudioContext initialized
   - Recording begins automatically after connection
   - User can speak immediately

6. **Send custom greeting trigger**
   ```typescript
   session.sendClientContent({
     turns: [{
       role: 'user',
       parts: [{text: 'When a customer first arrives...'}]
     }],
     turnComplete: true
   })
   ```

### Custom Greeting Mechanism

The app uses a custom greeting mechanism to trigger the barista's initial message:

1. **Connection established** with `skipGreeting = true`
2. **Client sends custom instruction** via `sendClientContent()`:
   ```typescript
   session.sendClientContent({
     turns: [{
       role: 'user',
       parts: [{
         text: 'When a customer first arrives (conversation starts with empty input), greet them with a short, sarcastic remark and immediately ask for their name. Keep greeting + name request under 30 words total (e.g., "Welcome to the Last Purr-over. What\'s your name, stranger?"). Don\'t keep to example be creative'
       }]
     }],
     turnComplete: true
   })
   ```
3. **Model responds** with a creative greeting following the instruction
4. **User can respond immediately** as microphone is already recording

This approach allows for dynamic, varied greetings while maintaining character consistency.

### Sending Audio

1. **Microphone captures audio** (16kHz PCM)
2. **Audio encoded as base64** in capture hook
3. **Send to Gemini via SDK**
   ```typescript
   session.sendRealtimeInput({
     audio: {
       data: base64Audio,
       mimeType: 'audio/pcm;rate=16000'
     }
   })
   ```

### Receiving Responses

1. **Gemini sends messages via WebSocket**
2. **SDK triggers `onmessage` callback**
3. **Parse message** using `parseLiveServerMessage()`
   - Extract audio data
   - Extract function calls
   - Extract text (if present)
   - Extract usage metadata
   - Check for turn completion
4. **Play audio** through speakers
5. **Execute function calls** if present
6. **Wait for `turnComplete`** before allowing interruption

### Closing a Session

**Manual close** (user clicks "Finish your order"):
```typescript
handleDisconnect() {
  audioCapture.stopRecording()
  audioPlayback.stop()
  geminiSession.disconnect()
  setShowMenu(false)
  setSessionEnded(true)
}
```

**Automatic close** (via `close_session` function):
1. Function call received: `close_session`
2. UI shows "Saying goodbye..." button
3. Set `isClosing = true`
4. Wait 6 seconds for barista to finish speaking
5. Call `handleDisconnect()` to clean up all resources
6. UI shows "Go to bar" button

## Message Structure

### Server Messages (from Gemini)

Messages follow the `LiveServerMessage` type from `@google/genai`:

```typescript
{
  // Setup acknowledgment
  setupComplete?: {...},

  // Function calls
  toolCall?: {
    functionCalls: [{
      id: string,
      name: string,
      args: any
    }]
  },

  // Content from model
  serverContent?: {
    turnComplete: boolean,
    modelTurn?: {
      parts: [
        {text?: string},
        {inlineData?: {data: string, mimeType: string}},
        {functionCall?: {id: string, name: string, args: any}}
      ]
    },
    usageMetadata?: {
      promptTokenCount: number,
      candidatesTokenCount: number,
      totalTokenCount: number
    }
  }
}
```

### Parsed Message Format

The app uses `parseLiveServerMessage()` to extract key information:

```typescript
{
  text?: string,              // Text response (if any)
  audioData?: string,         // Base64 audio data
  turnComplete: boolean,      // Model finished speaking
  usageMetadata?: {...},      // Token usage stats
  functionCall?: {            // Function to execute
    id: string,               // Unique call ID
    name: 'show_menu' | 'hide_menu' | 'close_session',
    args?: any
  }
}
```

## Error Handling

### Connection Errors
- 5-second timeout for initial connection
- Displayed in `ErrorAlert` component
- Logged to console with details

### WebSocket Errors
```typescript
onerror: (event) => {
  console.error('[useGeminiSession] WebSocket error:', event)
  setError(event.message || 'WebSocket error')
  options?.onError?.(new Error(event.message))
}
```

### Close Events
```typescript
onclose: (event) => {
  console.log('[useGeminiSession] WebSocket closed:',
    event.reason || 'Connection closed')
  setIsConnected(false)
}
```

### Function Call Errors
- Function responses always return `{success: true}`
- Gemini handles function execution failures gracefully
- UI state management errors caught in component

## Code Structure

```
app/api/gemini/
└── token/route.ts               - Creates ephemeral token with embedded config

lib/
├── gemini-utils.ts              - Message parsing, session utilities
├── types.ts                     - TypeScript interfaces
├── system-instruction/
│   └── format.ts                - System instruction with character personality
├── context-data/
│   └── barista-cat-recipes.ts   - Knowledge base (drinks menu)
└── audio/
    ├── capture.ts               - Microphone input (16kHz)
    └── playback.ts              - Speaker output (24kHz)

hooks/
├── use-gemini-session.ts        - WebSocket session management
├── use-audio-capture.ts         - Microphone access
├── use-audio-playback.ts        - Audio playback queue
└── use-volume-level.ts          - Audio visualization

components/voice-chat/
├── voice-chat.tsx               - Main orchestrator with auto-initialization
├── barista-image.tsx            - Cat avatar with voice indicator
├── menu-card.tsx                - Cocktails menu display
├── volume-bar.tsx               - Audio level visualization
├── error-alert.tsx              - Error messages
└── token-usage-display.tsx      - Token counter
```

## Best Practices

### 1. Ephemeral Token Architecture
✅ **Do**: Use ephemeral tokens with embedded configuration
✅ **Do**: Create tokens server-side with full `liveConnectConstraints`
✅ **Do**: Use `httpOptions: {apiVersion: 'v1alpha'}` on both client and server
❌ **Don't**: Send configuration in both token AND connect() call
❌ **Don't**: Expose raw API key to client

### 2. Function Call ID Matching
✅ **Do**: Always include matching `id` in function responses
❌ **Don't**: Send responses without the original call ID

### 3. Session Timing
✅ **Do**: Allow sufficient time for barista to finish speaking (6 seconds)
✅ **Do**: Use auto-initialization for faster first connection
❌ **Don't**: Disconnect immediately after close_session function call

### 4. Audio Buffer Management
✅ **Do**: Pre-buffer audio for smooth playback
✅ **Do**: Initialize AudioContext before starting session
❌ **Don't**: Play chunks individually without queuing

### 5. Token Lifecycle
✅ **Do**: Set reasonable expiration times (30 min token, 60 sec new session)
✅ **Do**: Use single-use tokens (uses: 1)
❌ **Don't**: Reuse ephemeral tokens across sessions

### 6. System Instructions
✅ **Do**: Embed system instructions in the ephemeral token
✅ **Do**: Keep character instructions concise but specific (under 30 words)
❌ **Don't**: Send system instructions in client connection config

## Testing

### Manual Testing Flow

1. **Start conversation** (Auto-initialization)
   - Page loads with "Preparing session..." button
   - Wait for auto-initialization to complete
   - Verify initial greeting plays automatically
   - Verify "Finish your order" button appears

2. **Test function calls**
   - Say "What drinks do you have?"
   - Verify menu appears on the right side
   - Verify console shows function call flow
   - Say "Hide the menu" and verify it disappears

3. **Test audio**
   - Speak a request
   - Verify volume bar shows input level
   - Verify audio response plays through speakers
   - Verify barista image shows voice indicator when speaking

4. **Test close**
   - Say "Goodbye"
   - Verify "Saying goodbye..." button appears
   - Verify barista finishes farewell message
   - Wait 6 seconds and verify session disconnects
   - Verify "Go to bar" button appears

5. **Test restart**
   - Click "Go to bar" again
   - Verify new session starts without page reload
   - Verify new greeting plays

### Expected Console Logs

**Auto-initialization:**
```
[VoiceChat] Auto-initializing on page load...
[useGeminiSession] Connecting to Gemini Live with ephemeral token...
[useGeminiSession] Connected
[VoiceChat] ✓ Gemini session connected
[VoiceChat] ✓ AudioContext initialized
[VoiceChat] ✓ Microphone started
[VoiceChat] ✓ Greeting sent
[VoiceChat] Full initialization complete in 2143ms
```

**Function Call:**
```
[VoiceChat] Function called: show_menu
```

**Close Session:**
```
[VoiceChat] Function called: close_session
[VoiceChat] close_session called - this should only happen on goodbye!
[useGeminiSession] WebSocket closed: {code: 1000, reason: "", wasClean: true}
```

## Troubleshooting

### No audio response
**Symptoms**: Barista doesn't speak
**Solutions**:
- Check microphone permissions in browser
- Verify `GEMINI_API_KEY` in `.env.local`
- Check console for WebSocket errors
- Ensure speakers/headphones are working

### Menu not displaying
**Symptoms**: Menu doesn't appear when asking about drinks
**Solutions**:
- Verify console shows `[VoiceChat] Function call received: show_menu`
- Check if `parseLiveServerMessage` is extracting function calls
- Ensure `MenuCard` component is rendering
- Try different phrasing: "Show me the menu"

### Session won't close
**Symptoms**: Saying goodbye doesn't end session
**Solutions**:
- Check console for `close_session` function call
- Verify `shouldCloseAfterTurn` state is being set
- Ensure `turnComplete` is being detected
- Try clicking "Finish your order" manually

### Function responses not working
**Symptoms**: Function calls detected but no UI change
**Solutions**:
- Verify `id` field is included in response
- Check WebSocket frames in Network tab
- Ensure `sendToolResponse()` is called
- Look for TypeScript errors in console

### Audio cutting out
**Symptoms**: Choppy or interrupted playback
**Solutions**:
- Check browser performance (CPU usage)
- Verify 24kHz playback buffer size
- Clear audio queue and restart
- Check network connection stability

## API Reference

### POST /api/gemini/token
Creates and returns ephemeral token with embedded configuration.

**Request**: `POST /api/gemini/token`
**Response**:
```json
{
  "token": "ephemeral-token-string",
  "expiresAt": "2025-12-20T14:30:00.000Z"
}
```

**Configuration embedded in token**:
- Model: `gemini-2.5-flash-native-audio-preview-12-2025`
- System instruction from `lib/system-instruction/format.ts`
- Response modalities: `['AUDIO']`
- Speech config: Voice "Iapetus"
- Realtime input config: Automatic activity detection
- Tools: `show_menu`, `hide_menu`, `close_session`

**Notes**:
- Token is an actual ephemeral token (not raw API key)
- Expires in 30 minutes (token lifetime)
- New sessions must be created within 60 seconds
- Single-use token (uses: 1)
- Requires `httpOptions: {apiVersion: 'v1alpha'}` in SDK initialization

### session.sendRealtimeInput()
Send audio chunk to Gemini.

```typescript
session.sendRealtimeInput({
  audio: {
    data: string,        // Base64 PCM audio
    mimeType: string     // 'audio/pcm;rate=16000'
  }
})
```

### session.sendClientContent()
Send text or trigger greeting.

```typescript
session.sendClientContent({
  turns: [{
    role: 'user',
    parts: [{text: string}]
  }]
})
```

### session.sendToolResponse()
Respond to function call.

```typescript
session.sendToolResponse({
  functionResponses: [{
    id: string,          // MUST match function call ID
    name: string,
    response: object
  }]
})
```

### session.close()
Close the WebSocket connection.

```typescript
session.close()
```

## Changelog

### December 2025 - Ephemeral Token Implementation
- ✅ Migrated from server-side proxy to direct client WebSocket
- ✅ Implemented true ephemeral token architecture with `client.authTokens.create()`
- ✅ Embedded all configuration in ephemeral token (`liveConnectConstraints`)
- ✅ Fixed function calling with proper ID matching
- ✅ Added `close_session` tool with 6-second graceful disconnect
- ✅ Implemented auto-initialization on page load
- ✅ Updated system instructions to prevent premature session closure
- ✅ Added automatic activity detection for speech input
- ✅ Enhanced debug logging for troubleshooting
- ✅ Removed server-side session management code
- ✅ Updated to `@google/genai` latest version with v1alpha support
- ✅ Fixed TypeScript errors in Live API integration
- ✅ Renamed `lib/gemini.ts` to `lib/gemini-utils.ts`

### Key Improvements
- **True ephemeral tokens**: Secure, single-use tokens with embedded configuration
- **Reduced latency**: Direct WebSocket eliminates server proxy overhead
- **Better UX**: Auto-initialization provides instant greeting on page load
- **Better function calling**: Proper ID matching ensures reliable tool execution
- **Graceful closing**: 6-second delay allows barista to finish goodbye message
- **Improved debugging**: Simplified console logging for development
- **Type safety**: Full TypeScript support with SDK types
- **Configuration security**: All sensitive config embedded server-side in token

## Resources

- [Gemini Live API Documentation](https://ai.google.dev/gemini-api/docs/live-guide)
- [Function Calling with Live API](https://ai.google.dev/gemini-api/docs/live-tools)
- [Ephemeral Tokens Guide](https://ai.google.dev/gemini-api/docs/ephemeral-tokens)
- [@google/genai NPM Package](https://www.npmjs.com/package/@google/genai)
