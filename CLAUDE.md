# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🗺️ Codebase Map

- **Stack**: Next.js 16, React 19, TypeScript, Gemini Live API
- **Entry**: `app/page.tsx` → `components/voice-chat/voice-chat.tsx`
- **Architecture**: Hook-based business logic + presentational components
- **Pattern**: Custom hooks manage single concerns, main component orchestrates
- **Docs**: See `docs/` folder for deep-dives on architecture, audio, and Gemini integration

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build
npm start

# Lint
npm run lint
```

**Environment Setup:**
Create `.env.local` with:
```
GEMINI_API_KEY=your_api_key_here
```

## 🧠 Contextual Rules (Auto-Loaded by File Type)

The following rules are automatically loaded when working with specific file types:

- **Hooks** (`hooks/**/*.ts`): @.claude/rules/hooks-patterns.md
- **Components** (`components/**/*.tsx`): @.claude/rules/component-patterns.md
- **Audio** (`lib/audio/**/*.ts`): @.claude/rules/audio-processing.md
- **API** (`app/api/**/*.ts`): @.claude/rules/api-security.md
- **Code Style** (all files): @.claude/rules/code-style.md

## 📝 Code Style

- **No inline comments** - Write self-documenting code with clear variable/function names
- **Exceptions:** Critical security warnings, complex algorithm explanations, external constraints
- **See:** `.claude/rules/code-style.md` for detailed guidelines

## 🚫 Critical Guardrails

1. **NEVER expose GEMINI_API_KEY to client code**
   - Always use ephemeral tokens from backend API
   - See: `.claude/rules/api-security.md`

2. **Function calls MUST include matching ID in response**
   - Hook handles this automatically
   - See: `hooks/use-gemini-session.ts:58-82`

3. **Audio sample rates are fixed**
   - Input: 16kHz (Gemini requirement)
   - Output: 24kHz (Gemini format)
   - See: `.claude/rules/audio-processing.md`

4. **Gapless playback requires 4-chunk pre-buffer**
   - Pre-buffer: 4 chunks (~400ms)
   - Look-ahead: 2-3 chunks
   - See: `lib/audio/playback.ts`

5. **Components should NEVER contain business logic**
   - All state management belongs in hooks
   - See: `.claude/rules/component-patterns.md`

## 📚 Deep Dive Documentation

For detailed technical information, see:

- **@docs/architecture.md** - Hook-based separation pattern, component hierarchy, session lifecycle, auto-initialization flow
- **@docs/gemini-live-integration.md** - Ephemeral token flow, WebSocket connection, message parsing, function calling with ID matching
- **@docs/audio-pipeline.md** - Mic→Gemini (16kHz PCM), Gemini→Speakers (24kHz PCM), gapless playback strategy, AudioWorklet implementation
- **@docs/vad-system.md** - Dual VAD architecture (server-side + client-side), VADFilter circular buffer, interruption detection logic

## 🔑 Key Files for Understanding

**Start here when onboarding:**
1. `components/voice-chat/voice-chat.tsx` - Main orchestrator (coordinates 5 hooks)
2. `hooks/use-gemini-session.ts` - WebSocket connection and message handling
3. `app/api/gemini/token/route.ts` - Ephemeral token creation with embedded config

**For specific concerns:**
- Audio capture: `hooks/use-audio-capture.ts`, `lib/audio/capture.ts`
- Audio playback: `hooks/use-audio-playback.ts`, `lib/audio/playback.ts`
- Voice detection: `hooks/use-vad.ts`, `lib/audio/vad-filter.ts`
- Message parsing: `lib/gemini-utils.ts`
- Character: `lib/system-instruction/format.ts`, `lib/context-data/barista-cat-recipes.ts`

## ⚙️ Common Tasks

### Adding New Gemini Tools/Functions

1. Define in `app/api/gemini/token/route.ts` tools array (lines 61-81)
2. Handle in `components/voice-chat/voice-chat.tsx` onFunctionCall callback
3. Update types in `lib/gemini-utils.ts` if needed
4. Response sent automatically by hook (no manual ID matching needed)

### Modifying Character Behavior

- Edit `lib/system-instruction/format.ts` for personality, tone, response length
- Edit `lib/context-data/barista-cat-recipes.ts` for menu items
- Token recreation is automatic on page refresh

### Adjusting Audio Settings

- Input sample rate: `lib/audio/capture.ts` (default: 16kHz, don't change)
- Output sample rate: `lib/audio/playback.ts` (default: 24kHz, don't change)
- Buffer sizes: `lib/audio/playback.ts` (pre-buffer: 4, look-ahead: 3)
- Server VAD: `app/api/gemini/token/route.ts:42-49`
- Client VAD: `hooks/use-vad.ts:36-42`

## 🛠️ Tech Stack

- **Next.js 16** (App Router) with React 19
- **TypeScript** with strict type checking
- **@google/genai** SDK v1.34.0+ for Gemini Live API
- **@ricky0123/vad-react** for client-side Voice Activity Detection
- **Web Audio API** (AudioContext, AudioWorklet, AnalyserNode)
- **Shadcn UI** for accessible components
- **Tailwind CSS** for styling

## 🐛 Common Issues

### "Failed to get API key"
- Missing or invalid `GEMINI_API_KEY` in `.env.local`
- Restart dev server after adding environment variable

### No audio playback
- AudioContext requires user gesture (handled automatically in auto-initialization)
- Check browser console for AudioContext errors
- Verify AudioContext state is 'running'

### Choppy/stuttering audio
- Increase pre-buffer size in `lib/audio/playback.ts` (from 4 to 6)
- Check network latency to Gemini API (DevTools Network tab)

### Double connections in dev mode
- React StrictMode runs effects twice (normal in development)
- Fixed automatically in production build

### Token expired errors
- Tokens last 3 minutes (configurable in `app/api/gemini/token/route.ts:21-22`)
- Refresh page to get new token

### VAD not working
- Check browser console for VAD initialization errors
- Fallback behavior: always passes audio through (isSpeechDetected=true)

## 📖 Additional Resources

- **README.md** - User-facing documentation, deployment guide, learning resources
- **docs/how-to-use-new-gemini-live-api.md** - Gemini Live API integration guide

---

**For progressive disclosure:** Start with this file, then explore contextual rules (auto-loaded), then deep-dive into docs/ as needed.
