# How to Use Gemini Live API (December 2025)

This guide explains how the Barista-Cat app uses the new Gemini Live API with direct client-side WebSocket connections.

## Overview

The Gemini Live API enables real-time, bidirectional audio conversations with Gemini models using WebSocket connections. This app uses it to create a voice-based barista experience with the character "Whiskerjack," a sarcastic post-apocalyptic barista cat.

## Architecture

### Client-Side Direct Connection (New Approach)
- **Direct WebSocket connection** from browser to Gemini Live API
- API key fetched from backend endpoint (`/api/gemini/token`)
- No server-side proxy - minimal latency for real-time audio
- Session managed entirely by the `@google/genai` SDK in the browser

### Security
- API key stored server-side in environment variables
- Token endpoint returns API key to authenticated clients only
- Sessions expire after 3 minutes (enforced by Gemini)

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
- **Response modalities**: `[Modality.AUDIO]` - Audio-only responses
- **System instruction**: Whiskerjack character personality
  - "You are 'Whiskerjack', a post-apocalyptic barista cat"
  - "Be sarcastic but charming"
  - "Keep responses under 20 words"
  - Initial greeting with max 10 words when conversation starts

### Audio Settings
- **Input**: 16kHz PCM mono, echo cancellation, noise suppression
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
"Hide the cocktails menu from view. Call this when user is done looking at the menu or conversation moves on."

**Trigger phrases:**
- "That's enough"
- "Hide the menu"
- User moves on to ordering

**Response**: UI hides the menu card

### 3. close_session
**Purpose**: End the conversation gracefully

**Description**:
"End the conversation and close the session. Call this when the user/customer says goodbye, indicates they want to leave, or says they are done ordering."

**Trigger phrases:**
- "Goodbye"
- "Bye"
- "I'm done"
- "See you later"
- "Thanks, that's all"

**Response**:
1. Barista finishes their farewell message (waits for `turnComplete`)
2. Session disconnects
3. UI resets to "Go to bar" button

**Important**: The session waits for the model's turn to complete before disconnecting, allowing the barista to finish their goodbye message.

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

1. **User clicks "Go to bar"**
   ```typescript
   await geminiSession.connect()
   ```

2. **Fetch API key from backend**
   ```typescript
   const response = await fetch('/api/gemini/token', {method: 'POST'})
   const {token} = await response.json()
   ```

3. **Initialize GoogleGenAI SDK**
   ```typescript
   const ai = new GoogleGenAI({apiKey: token})
   ```

4. **Connect to Gemini Live WebSocket**
   ```typescript
   const session = await ai.live.connect({
     model: 'gemini-2.5-flash-native-audio-preview-12-2025',
     config: {
       responseModalities: [Modality.AUDIO],
       systemInstruction: {...},
       speechConfig: {...},
       tools: [...]
     },
     callbacks: {
       onopen: () => {...},
       onmessage: (msg) => {...},
       onerror: (err) => {...},
       onclose: (evt) => {...}
     }
   })
   ```

5. **Auto-start microphone**
   - Recording begins automatically after connection
   - User can speak immediately

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
session.close()
```

**Automatic close** (via `close_session` function):
1. Function call received
2. Set `shouldCloseAfterTurn = true`
3. Wait for message with `turnComplete: true`
4. Disconnect gracefully

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
└── token/route.ts          - Returns API key for client connection

lib/
├── gemini.ts               - Message parsing, session utilities
├── types.ts                - TypeScript interfaces
└── audio/
    ├── capture.ts          - Microphone input (16kHz)
    └── playback.ts         - Speaker output (24kHz)

hooks/
├── use-gemini-session.ts   - WebSocket session management
├── use-audio-capture.ts    - Microphone access
├── use-audio-playback.ts   - Audio playback queue
└── use-volume-level.ts     - Audio visualization

components/voice-chat/
├── voice-chat.tsx          - Main orchestrator
├── barista-image.tsx       - Cat avatar with voice indicator
├── menu-card.tsx           - Cocktails menu display
├── volume-bar.tsx          - Audio level visualization
├── error-alert.tsx         - Error messages
└── token-usage-display.tsx - Token counter
```

## Best Practices

### 1. Direct WebSocket Connection
✅ **Do**: Use client-side SDK for minimal latency
❌ **Don't**: Create server-side proxy unless necessary for security

### 2. Function Call ID Matching
✅ **Do**: Always include matching `id` in function responses
❌ **Don't**: Send responses without the original call ID

### 3. Turn Completion
✅ **Do**: Wait for `turnComplete` before disruptive actions
❌ **Don't**: Disconnect mid-sentence

### 4. Audio Buffer Management
✅ **Do**: Pre-buffer audio for smooth playback
❌ **Don't**: Play chunks individually without queuing

### 5. API Key Security
✅ **Do**: Store API key server-side only
❌ **Don't**: Expose API key in client code

### 6. System Instructions
✅ **Do**: Keep character instructions concise and clear
❌ **Don't**: Over-specify behavior (let the model be creative)

## Testing

### Manual Testing Flow

1. **Start conversation**
   - Click "Go to bar"
   - Verify connection logs appear
   - Wait for initial greeting

2. **Test function calls**
   - Say "What drinks do you have?"
   - Verify menu appears
   - Verify console shows function call flow

3. **Test audio**
   - Speak a request
   - Verify volume bar shows input
   - Verify audio response plays

4. **Test close**
   - Say "Goodbye"
   - Verify barista finishes message
   - Verify session disconnects cleanly

### Expected Console Logs

**Connection:**
```
[useGeminiSession] Requesting API key...
[useGeminiSession] API key received
[useGeminiSession] Connecting to Gemini Live API...
[useGeminiSession] WebSocket connected
[VoiceChat] Connected and recording started
```

**Function Call:**
```
[useGeminiSession] RAW MESSAGE WITH FUNCTION CALL: {...}
[parseLiveServerMessage] Found toolCall.functionCalls: [...]
[parseLiveServerMessage] Checking function call: show_menu
[parseLiveServerMessage] ✅ Function call extracted: {id: "...", name: "show_menu", args: {}}
[useGeminiSession] 🎯 Calling handleFunctionCall with: {...}
[useGeminiSession] Function call: {id: "...", name: "show_menu", args: {}}
[VoiceChat] Function call received: show_menu {}
```

**Turn Complete:**
```
[useGeminiSession] Parsed message: {hasText: false, hasAudio: true, hasFunctionCall: false, turnComplete: true}
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
Returns API key for client-side connection.

**Request**: `POST /api/gemini/token`
**Response**:
```json
{
  "token": "your-api-key",
  "expiresAt": "2025-12-20T14:00:00.000Z"
}
```

**Notes**:
- Token is the actual API key (not an ephemeral token)
- Future versions will use true ephemeral tokens when SDK supports it
- Expires in 3 minutes

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

### December 2025 - Direct Client Connection
- ✅ Migrated from server-side proxy to direct client WebSocket
- ✅ Implemented ephemeral token architecture (API key endpoint)
- ✅ Fixed function calling with proper ID matching
- ✅ Added `close_session` tool with graceful disconnect
- ✅ Improved turn completion handling
- ✅ Enhanced debug logging for troubleshooting
- ✅ Removed server-side session management code
- ✅ Updated to `@google/genai` v1.34.0
- ✅ Fixed TypeScript errors in Live API integration
- ✅ Implemented delayed disconnect to allow barista to finish speaking

### Key Improvements
- **Reduced latency**: Direct WebSocket eliminates server proxy overhead
- **Better function calling**: Proper ID matching ensures reliable tool execution
- **Graceful closing**: Barista can finish goodbye before disconnect
- **Improved debugging**: Comprehensive console logging for development
- **Type safety**: Full TypeScript support with SDK types

## Resources

- [Gemini Live API Documentation](https://ai.google.dev/gemini-api/docs/live-guide)
- [Function Calling with Live API](https://ai.google.dev/gemini-api/docs/live-tools)
- [Ephemeral Tokens Guide](https://ai.google.dev/gemini-api/docs/ephemeral-tokens)
- [@google/genai NPM Package](https://www.npmjs.com/package/@google/genai)
