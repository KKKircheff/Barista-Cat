# Gemini Live API Integration

## Ephemeral Token Security Architecture

**Critical security pattern:** API keys NEVER reach the frontend.

### The Flow

```
1. Page Load
   ↓
2. Frontend requests token: POST /api/gemini/token
   ↓
3. Backend creates ephemeral token with GoogleGenAI SDK
   - Uses server-side GEMINI_API_KEY from env
   - Embeds full configuration in token
   - Returns token (not API key) to frontend
   ↓
4. Frontend connects to Gemini Live with token
   - Token contains all config (system instruction, tools, voice)
   - Token valid for 3 minutes, single use
   - No API key exposed to client
```

### Backend: Token Creation

**File:** `app/api/gemini/token/route.ts`

**Process:**

```typescript
// 1. Initialize SDK with server-side API key
const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY  // Never sent to client
});

// 2. Create ephemeral token with FULL configuration
const tokenResponse = await client.authTokens.create({
  config: {
    uses: 1,                           // Single session per token
    expireTime: '180 seconds',         // Token validity
    newSessionExpireTime: '180 seconds', // New session window
    liveConnectConstraints: {
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        systemInstruction: { /* Character profile */ },
        responseModalities: ['AUDIO'],
        speechConfig: { voiceName: 'Iapetus' },
        tools: [ /* Function declarations */ ],
        realtimeInputConfig: { /* Server-side VAD */ }
      }
    }
  }
});

// 3. Return only the token (not API key)
return { token: tokenResponse.name };
```

### Frontend: Connection with Token

**File:** `hooks/use-gemini-session.ts`

**Process:**

```typescript
// 1. Fetch ephemeral token
const response = await fetch('/api/gemini/token', { method: 'POST' });
const { token } = await response.json();

// 2. Initialize SDK with token (NOT api key)
const ai = new GoogleGenAI({
  apiKey: token,  // This is the ephemeral token
  httpOptions: { apiVersion: 'v1alpha' }
});

// 3. Connect with MINIMAL config (everything is in token)
const session = await ai.live.connect({
  model: GEMINI_MODELS.LIVE_FLASH_NATIVE,
  callbacks: { onopen, onmessage, onerror, onclose }
});
```

**Why minimal config?** All configuration (system instruction, tools, voice, VAD settings) is already embedded in the token. No need to re-specify.

## Token Configuration Deep Dive

### System Instruction

**Embedded in token:** `lib/system-instruction/format.ts`

Contains:
- Character profile ("Whiskerjack" the post-apocalyptic barista cat)
- Tone and personality rules
- Role and behavior guidelines
- Knowledge base rules (only reference drinks in context)
- Conversation rules (language switching, short responses)
- Order handling flow
- Tool usage instructions

**Why in token?** Prevents frontend from manipulating character behavior. Ensures consistent personality across sessions.

### Context Data

**Embedded in token:** `lib/context-data/barista-cat-recipes.ts`

Contains:
- Menu of cocktails and coffees
- Drink descriptions and ingredients
- Post-apocalyptic themed recipe details

**Why in token?** Knowledge base is injected once, not sent with every message. Reduces token consumption.

### Response Modalities

```typescript
responseModalities: ['AUDIO']
```

**Effect:** Gemini responds ONLY with audio, no text. Optimizes for voice-first interaction.

### Speech Config

```typescript
speechConfig: {
  voiceConfig: {
    prebuiltVoiceConfig: {
      voiceName: 'Iapetus'  // Gemini's voice selection
    }
  }
}
```

**Voice:** "Iapetus" - chosen for character fit (deep, slightly robotic tone for post-apocalyptic setting)

### Tools (Function Declarations)

```typescript
tools: [{
  functionDeclarations: [
    {
      name: 'show_menu',
      description: 'Show the cocktails and drinks menu...'
    },
    {
      name: 'hide_menu',
      description: 'Hide the cocktails menu...'
    },
    {
      name: 'close_session',
      description: 'CRITICAL: ONLY call when user wants to LEAVE...'
    }
  ]
}]
```

**Why in token?** Function declarations are part of the model's configuration, not runtime data.

### Realtime Input Config (Server-Side VAD)

```typescript
realtimeInputConfig: {
  automaticActivityDetection: {
    disabled: false,
    startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
    silenceDurationMs: 200
  }
}
```

**Effect:** Gemini automatically detects when user is speaking vs silent. Prevents model from responding during user speech.

### Token Lifetime Configuration

```typescript
expireTime: 180 seconds         // Token valid for 3 minutes
newSessionExpireTime: 180 seconds // Window to create new session
uses: 1                          // Single session per token
```

**Why 3 minutes?** Balances security (short-lived) with UX (enough time for conversation). Tokens auto-expire if unused.

## WebSocket Connection Flow

### 1. Connection Establishment

```typescript
const session = await ai.live.connect({
  model: GEMINI_MODELS.LIVE_FLASH_NATIVE,
  callbacks: {
    onopen: () => {
      console.log('Connected');
      setIsConnected(true);
    },
    onmessage: (msg) => {
      handleMessage(msg);  // Parse and process
    },
    onerror: (event) => {
      console.error('WebSocket error:', event);
      setError(event.message);
    },
    onclose: (event) => {
      console.log('WebSocket closed:', event);
      setIsConnected(false);
    }
  }
});
```

### 2. Sending Audio

**Format:** Base64-encoded 16kHz mono PCM

```typescript
session.sendRealtimeInput({
  audio: {
    data: base64Audio,              // Base64 string
    mimeType: 'audio/pcm;rate=16000' // MUST specify sample rate
  }
});
```

**Source:** Audio comes from `use-audio-capture` hook → AudioWorklet → VADFilter → sendAudio()

### 3. Sending Greeting Trigger

```typescript
session.sendClientContent({
  turns: [{
    role: 'user',
    parts: [{ text: '' }]  // Empty text
  }],
  turnComplete: true       // Signal: user is done, your turn
});
```

**Why empty text?** Forces model to speak first without requiring user input. Used to trigger bartender greeting.

### 4. Receiving Messages

**Multiple formats** - Gemini sends different message structures:

```typescript
// Format 1: Setup complete
{ setupComplete: true }

// Format 2: Audio data (most common)
{
  serverContent: {
    modelTurn: {
      parts: [
        { inlineData: { data: 'base64...', mimeType: 'audio/pcm' } }
      ]
    },
    turnComplete: false
  }
}

// Format 3: Function call
{
  toolCall: {
    functionCalls: [
      { id: 'abc123', name: 'show_menu', args: {} }
    ]
  }
}

// Format 4: Token usage
{
  usageMetadata: {
    promptTokenCount: 150,
    candidatesTokenCount: 200,
    totalTokenCount: 350
  }
}
```

**Parser:** `lib/gemini-utils.ts:parseLiveServerMessage()` normalizes all formats into consistent structure.

## Function Calling Pattern

### Function Call Lifecycle

```
1. Gemini decides to call function based on conversation
   ↓
2. WebSocket sends toolCall message with ID
   ↓
3. handleMessage() parses and extracts function call
   ↓
4. handleFunctionCall() executes and notifies component
   ↓
5. Component executes UI action (e.g., setShowMenu(true))
   ↓
6. Hook automatically sends response with MATCHING ID
   ↓
7. Gemini receives confirmation and continues
```

### Critical: ID Matching

**The Problem:** Gemini needs to know which function call you're responding to.

**The Solution:** Include the exact ID from the incoming call in your response.

```typescript
// Incoming function call
{
  toolCall: {
    functionCalls: [{
      id: 'call_abc123',      // THIS ID MUST BE MATCHED
      name: 'show_menu',
      args: {}
    }]
  }
}

// Response (MUST include same ID)
session.sendToolResponse({
  functionResponses: [{
    id: 'call_abc123',       // SAME ID
    name: 'show_menu',
    response: {
      success: true,
      message: 'Menu displayed'
    }
  }]
});
```

**What happens if ID doesn't match?** Gemini will wait indefinitely for the correct response, blocking conversation.

### Automatic Handling

**Location:** `hooks/use-gemini-session.ts:58-82`

```typescript
const handleFunctionCall = useCallback((functionCall) => {
  // 1. Notify component (for UI action)
  if (options?.onFunctionCall) {
    options.onFunctionCall(functionCall.name, functionCall.args);
  }

  // 2. Automatically send response with matching ID
  if (sessionRef.current) {
    sessionRef.current.sendToolResponse({
      functionResponses: [{
        id: functionCall.id,  // CRITICAL: matching ID
        name: functionCall.name,
        response: {
          success: true,
          message: `Function ${functionCall.name} executed`
        }
      }]
    });
  }
}, [options]);
```

**Component only needs to:**

```typescript
onFunctionCall: (functionName, args) => {
  if (functionName === 'show_menu') setShowMenu(true);
  if (functionName === 'hide_menu') setShowMenu(false);
  if (functionName === 'close_session') handleDisconnect();
}
```

**Hook handles the response automatically.** No need to worry about IDs in components.

## Message Parsing

**File:** `lib/gemini-utils.ts:parseLiveServerMessage()`

**Why complex?** Gemini sends messages in different formats depending on:
- Message type (audio, function call, usage)
- API version (v1alpha vs stable)
- Connection state (setup vs active)

**Parser normalizes to:**

```typescript
{
  text?: string,                    // Text response (if any)
  audioData?: string,               // Base64 audio (if any)
  turnComplete: boolean,            // Model finished speaking
  usageMetadata?: {
    promptTokenCount: number,
    candidatesTokenCount: number,
    totalTokenCount: number
  },
  functionCall?: {
    id: string,                     // For response matching
    name: 'show_menu' | 'hide_menu' | 'close_session',
    args?: any
  }
}
```

**Usage:**

```typescript
const parsed = parseLiveServerMessage(message);

if (parsed.audioData) {
  audioPlayback.play(parsed.audioData);  // Play audio
}

if (parsed.functionCall) {
  handleFunctionCall(parsed.functionCall);  // Execute function
}

if (parsed.usageMetadata) {
  setTokenUsage(parsed.usageMetadata);  // Update stats
}
```

## Error Handling

### Connection Errors

```typescript
onerror: (event) => {
  const errorMsg = event.message || 'WebSocket error';
  setError(errorMsg);

  if (options?.onError) {
    options.onError(new Error(errorMsg));
  }
}
```

**Common errors:**
- Token expired (3 min limit exceeded)
- Invalid token (backend API key issue)
- Network failure (WebSocket disconnected)
- Rate limit exceeded (too many requests)

### Token Expiration

**Symptom:** WebSocket closes with reason "Token expired"

**Solution:** Refresh page to get new token

**Why not auto-refresh?** Token creation requires backend call. Simpler to refresh page than implement token refresh flow.

### Rate Limiting

**Symptom:** 429 error from `/api/gemini/token`

**Solution:** Wait and retry (Gemini API rate limits)

**Backend handling:**

```typescript
if (error.message.includes('quota') || error.message.includes('rate limit')) {
  return NextResponse.json(
    { error: 'Rate limit exceeded. Please try again later.' },
    { status: 429 }
  );
}
```

## Security Considerations

### Why Ephemeral Tokens?

1. **API Key Protection** - Key never leaves server
2. **Scope Limitation** - Token limited to single session
3. **Time Limitation** - 3 minute expiration
4. **Config Enforcement** - Client can't modify system instruction or tools
5. **Audit Trail** - Each token tracked separately

### What's Embedded vs Runtime

**Embedded in token (immutable):**
- System instruction
- Context data (menu)
- Tools (function declarations)
- Voice selection
- VAD configuration

**Sent at runtime:**
- User audio
- Greeting triggers
- Function responses

**Why?** Prevents client-side manipulation of core behavior while allowing real-time interaction.

### Token Storage

**Not stored:** Tokens are fetched on demand and used immediately. No localStorage, no cookies.

**Lifetime:** 3 minutes from creation, single use, then discarded.

**Why not store?** Security - minimize attack surface. If token leaked, it expires quickly and can't be reused.
