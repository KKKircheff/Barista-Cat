# Barista Cat - Gemini Live API Voice Chat Demo 

Educational project demonstrating real-time voice conversations using Google's Gemini Live API with ephemeral tokens.

## What This Is

A Next.js voice chat application featuring Whiskerjack, a post-apocalyptic barista cat powered by Gemini 2.5 Flash. Users have natural voice conversations to order drinks from a themed menu.

## Deployed on vercel

## Key Features

- **Real-time Voice Chat**: Bidirectional audio streaming via WebSockets
- **Ephemeral Token Security**: API keys never exposed to frontend
- **Function Calling**: AI controls UI (show/hide menu, close session)
- **Gapless Audio Playback**: Sophisticated buffering for smooth responses
- **Web Audio API**: Custom AudioWorklet for microphone processing

## Architecture Overview

### Frontend → Backend → Gemini Flow

1. **User loads page** → Auto-initialization sequence
2. **Frontend requests token** → `POST /api/gemini/token`
3. **Backend creates ephemeral token** → Includes full config (system instruction, tools, voice)
4. **Frontend connects** → WebSocket to Gemini Live with token
5. **Audio streaming** → Bidirectional PCM audio (16kHz in, 24kHz out)
6. **Function calls** → AI triggers UI changes via tools

### Custom Hooks (Business Logic Layer)

- **use-gemini-session.ts** - WebSocket connection, message parsing, token tracking
- **use-audio-capture.ts** - Microphone access, AudioWorklet processing
- **use-audio-playback.ts** - Gapless audio playback, buffering strategy
- **use-volume-level.ts** - Real-time volume visualization

### Components (Presentation Layer)

- **voice-chat.tsx** - Main orchestrator (coordinates all hooks)
- **barista-image.tsx** - Character image with voice indicator
- **voice-indicator.tsx** - Animated audio visualization (60 circular bars)
- **menu-card.tsx** - Drink menu (6 cocktails + 6 coffees)
- **token-usage-display.tsx** - Real-time token consumption stats

### System Instruction & Context

- **lib/system-instruction/format.ts** - Character profile, behavior rules
- **lib/context-data/barista-cat-recipes.ts** - Menu knowledge base
- Injected into ephemeral token on backend (never sent from frontend)

## Gemini Live API Integration

### Ephemeral Token Pattern

**Why?** Security best practice - API keys stay on server, frontend gets short-lived tokens.

**Backend** (`app/api/gemini/token/route.ts`):
```typescript
const tokenResponse = await client.authTokens.create({
  config: {
    uses: 1,
    expireTime: '30 minutes from now',
    newSessionExpireTime: '60 seconds from now',
    liveConnectConstraints: {
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        systemInstruction: { /* Character profile */ },
        responseModalities: ['AUDIO'],
        speechConfig: { voiceName: 'Iapetus' },
        tools: [ /* show_menu, hide_menu, close_session */ ]
      }
    }
  }
});
```

**Frontend** (`hooks/use-gemini-session.ts`):
```typescript
// 1. Fetch token
const {token} = await fetch('/api/gemini/token', {method: 'POST'}).then(r => r.json());

// 2. Connect with token (config already embedded)
const ai = new GoogleGenAI({apiKey: token});
const session = await ai.live.connect({
  model: GEMINI_MODELS.LIVE_FLASH_NATIVE,
  callbacks: { onopen, onmessage, onerror, onclose }
});
```

### Audio Pipeline

**Microphone → Gemini:**
- Browser captures audio → AudioContext (48kHz typically)
- AudioWorklet resamples to 16kHz mono PCM
- Base64 encode → Send via WebSocket
- Format: `{audio: {data: base64, mimeType: 'audio/pcm;rate=16000'}}`

**Gemini → Speakers:**
- Receive base64 24kHz PCM via WebSocket
- Decode → Int16Array → Float32Array
- Create AudioBufferSourceNode
- Pre-buffer 4 chunks (400ms), schedule 2-3 ahead for gapless playback
- Track playback state for voice indicator animation

### Function Calling Pattern

**Tools Configuration** (in ephemeral token):
```typescript
tools: [{
  functionDeclarations: [
    {name: 'show_menu', description: 'Show drinks menu...'},
    {name: 'hide_menu', description: 'Hide menu...'},
    {name: 'close_session', description: 'End conversation...'}
  ]
}]
```

**Handling Function Calls:**
```typescript
if (message.toolCall?.functionCalls) {
  const {id, name, args} = functionCall;

  // 1. Execute action in UI
  if (name === 'show_menu') setShowMenu(true);

  // 2. Send response back (CRITICAL: include matching ID)
  session.sendToolResponse({
    functionResponses: [{
      id: id,  // Must match the call ID
      name: name,
      response: {success: true, message: 'Executed'}
    }]
  });
}
```

## Project Structure

```
hooks/                      # Custom React hooks (business logic)
  ├── use-gemini-session.ts # WebSocket, message parsing, tokens
  ├── use-audio-capture.ts  # Microphone → 16kHz PCM
  ├── use-audio-playback.ts # 24kHz PCM → Speakers (gapless)
  └── use-volume-level.ts   # Volume visualization

lib/
  ├── gemini-utils.ts       # Message parsing, model constants
  ├── types.ts              # TypeScript interfaces
  ├── audio/
  │   ├── capture.ts        # AudioWorklet setup, volume calc
  │   └── playback.ts       # Buffering strategy, scheduling
  ├── system-instruction/
  │   └── format.ts         # Character profile, behavior rules
  └── context-data/
      └── barista-cat-recipes.ts  # Menu knowledge base

app/
  ├── api/gemini/token/route.ts   # Ephemeral token generation
  └── page.tsx                    # Home page

components/
  ├── voice-chat/
  │   ├── voice-chat.tsx          # Main orchestrator
  │   ├── barista-image.tsx       # Character + voice indicator
  │   ├── voice-indicator.tsx     # Circular audio animation
  │   ├── menu-card.tsx           # Drink menu display
  │   └── token-usage-display.tsx # Token stats
  ├── ui/                         # Shadcn components
  └── shared/                     # Gradient buttons/cards

public/
  ├── audio-processor.worklet.js  # AudioWorklet for mic processing
  └── images/                     # Barista cat artwork
```

## Setup & Run

### Prerequisites
- Node.js 18+
- Gemini API key ([Get one here](https://aistudio.google.com/apikey))

### Installation
```bash
npm install
```

### Environment Variables
Create `.env.local`:
```
GEMINI_API_KEY=your_api_key_here
```

### Development
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build
```bash
npm run build
npm start
```

## Learning Resources

### Understanding the Code

**Start here:**
1. **Main orchestrator:** `components/voice-chat/voice-chat.tsx` - See how hooks coordinate
2. **WebSocket management:** `hooks/use-gemini-session.ts` - Token fetch + connection
3. **Audio capture:** `hooks/use-audio-capture.ts` - Microphone → base64 chunks
4. **Audio playback:** `hooks/use-audio-playback.ts` - Gapless buffering strategy
5. **Token generation:** `app/api/gemini/token/route.ts` - Ephemeral token creation

### Key Concepts

**Ephemeral Tokens:**
- Security pattern for client-side API usage
- Config embedded in token (system instruction, tools, voice)
- Short-lived (30 min session, 60s new session window)

**Audio Buffering:**
- Pre-buffer: Wait for 4 chunks before first play (400ms buffer)
- Look-ahead: Schedule 2-3 chunks in advance
- Re-buffer: Pause if queue drops below 3 chunks
- Precise timing: Use `AudioContext.currentTime` for scheduling

**Function Calling:**
- Tools defined in token config
- Gemini calls functions to control UI
- Frontend must respond with matching ID
- Enables voice-controlled interfaces

**Character System:**
- All behavior in system instruction (no hardcoded responses)
- Knowledge base injected as context
- Voice selection via `speechConfig`

## Extending the App

### Add New Menu Items
Edit `lib/context-data/barista-cat-recipes.ts` - Gemini will automatically know about them.

### Change Character Personality
Modify `lib/system-instruction/format.ts` - Adjust tone, response length, behavior.

### Add New Tools
1. Define in `app/api/gemini/token/route.ts` tools array
2. Handle in `components/voice-chat/voice-chat.tsx` onFunctionCall
3. Describe clearly so Gemini knows when to call

### Adjust Audio Settings
- **Input sample rate:** `lib/audio/capture.ts` (default 16kHz)
- **Output sample rate:** `lib/audio/playback.ts` (default 24kHz)
- **Buffer sizes:** Pre-buffer (4), look-ahead threshold (3)

## Technical Highlights

- **React 19 + Next.js 16** - Latest features, React Compiler compatible
- **TypeScript** - Full type safety across hooks and components
- **Shadcn UI** - Composable, accessible components
- **Web Audio API** - Low-latency audio processing
- **AudioWorklet** - Off-main-thread audio processing for smooth performance
- **Gemini 2.5 Flash** - Native audio model (no speech-to-text intermediary)

## Common Issues

**"Failed to get API key"** - Check `.env.local` has `GEMINI_API_KEY`

**No audio playback** - AudioContext requires user gesture (handled automatically on page load)

**Choppy audio** - Adjust buffer sizes in `lib/audio/playback.ts`

**Double connections in dev** - React StrictMode runs effects twice (normal in dev, fixed in production)

**Token expired** - Tokens last 30 min, refresh page to get new one

## License

MIT - Educational purposes

## Credits

Built with:
- Google Gemini Live API
- Next.js
- Shadcn UI
- Tailwind CSS

