# How to Use Gemini Live API 2.0

This guide explains how the Barista-Cat app uses the new Gemini Live API (December 2025).

## Overview

The Gemini Live API enables real-time, bidirectional audio conversations with Gemini models. This app uses it to create a voice-based barista experience.

## Architecture

### Server-Side (Security)
- API key stays on the server
- WebSocket connections managed via `lib/gemini-server.ts`
- Sessions stored in-memory with 3-minute timeout

### Client-Side
- HTTP proxy endpoints: `/api/gemini/session`, `/api/gemini/audio`, `/api/gemini/stream`
- Server-Sent Events (SSE) for receiving responses
- Audio capture at 16kHz PCM mono
- Audio playback at 24kHz with gapless buffering

## Configuration

### Model
`gemini-2.5-flash-native-audio-preview-12-2025`

### Voice
Iapetus (conversational, clear)

### Response Settings
- Max output tokens: 50 (keeps responses concise)
- Response modalities: Audio only
- System instruction: Whiskerjack character (post-apocalyptic barista cat)

### Audio Settings
- **Input:** 16kHz PCM mono, echo cancellation, noise suppression
- **Output:** 24kHz PCM, pre-buffering for smooth playback

## Function Calling (Tools)

### show_menu Tool
Detects when user asks about drinks/menu and triggers menu display.

**Trigger phrases:**
- "What drinks do you have?"
- "Show me the menu"
- "What cocktails are available?"

**Response:** UI displays menu card under cat avatar

## Session Management

### Creating a Session
1. Client calls `POST /api/gemini/session`
2. Server creates WebSocket connection to Gemini
3. Returns session ID to client
4. Client opens SSE stream: `GET /api/gemini/stream?sessionId={id}`

### Sending Audio
1. Microphone captures audio (16kHz PCM)
2. Encoded as base64
3. Client sends: `POST /api/gemini/audio` with sessionId and audioData
4. Server forwards to Gemini WebSocket

### Receiving Responses
1. Gemini sends responses via WebSocket
2. Server queues messages
3. SSE stream polls every 50ms and sends to client
4. Client plays audio through speakers

### Session Timeout
Sessions auto-cleanup after 3 minutes of inactivity.

## Error Handling

### Connection Timeout
5-second timeout for initial WebSocket connection.

### Error Logs
Enhanced logging for debugging:
- WebSocket error details (type, message, timestamp)
- Close events (code, reason, wasClean)
- Session lifecycle events

## Code Structure

```
app/api/gemini/
├── session/route.ts    - Create/delete sessions
├── audio/route.ts      - Send audio chunks
└── stream/route.ts     - SSE response stream

lib/
├── gemini-server.ts    - Server-side session manager
├── gemini.ts           - Message parsing utilities
├── audio/
│   ├── capture.ts      - Microphone input
│   └── playback.ts     - Speaker output

components/voice-chat/
├── voice-chat.tsx      - Main orchestrator
├── barista-image.tsx   - Cat avatar
├── menu-card.tsx       - Cocktails menu
└── volume-bar.tsx      - Audio visualization
```

## Best Practices

1. **Keep responses short** - maxOutputTokens: 50 prevents long-winded responses
2. **Use function calling** - Triggers UI actions without parsing text
3. **Pre-buffer audio** - Prevents gaps in playback
4. **Server-side API key** - Never expose credentials to client
5. **Session cleanup** - Automatic timeout prevents memory leaks

## Testing

### Manual Testing
1. Click "Start order" to begin session
2. Speak a request (e.g., "What drinks do you have?")
3. Verify audio response plays
4. Verify menu displays if drinks mentioned
5. Click "Finish order" to end session

### Expected Logs
```
[GeminiServer] Creating session {id}...
[GeminiServer] ai.live.connect() completed for session {id}
[GeminiServer] Session {id} WebSocket connected
```

## Troubleshooting

### No audio response
- Check microphone permissions
- Verify GEMINI_API_KEY in environment
- Check browser console for errors

### Menu not displaying
- Verify user asked about drinks/menu
- Check console for function call messages
- Ensure showMenu state updates

### Session timeout
- Default 3-minute inactivity timeout
- Adjust in `gemini-server.ts` line 218 if needed

## API Reference

### POST /api/gemini/session
Creates a new Gemini Live session.

**Response:** `{ sessionId: string }`

### DELETE /api/gemini/session?sessionId={id}
Closes a session.

### POST /api/gemini/audio
Sends audio chunk to session.

**Body:** `{ sessionId: string, audioData: string }`

### GET /api/gemini/stream?sessionId={id}
Server-Sent Events stream for responses.

**Events:** JSON-encoded ParsedServerMessage objects

## Changelog

### December 2025
- Implemented Gemini Live API 2.0
- Added function calling for menu display
- Changed voice to Iapetus
- Set maxOutputTokens to 50
- Removed text transcript display
- Enhanced error logging
