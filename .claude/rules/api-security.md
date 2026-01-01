# API Security Patterns

This file is automatically loaded when working with files matching `app/api/**/*.ts`.

## CRITICAL: Ephemeral Token Pattern

### Security Principle

**NEVER expose the GEMINI_API_KEY to the client.**

**Why?**
1. API keys in client code can be extracted by anyone
2. Malicious actors can abuse your quota
3. Can't revoke compromised keys easily
4. No control over client-side key usage

**Solution:** Ephemeral tokens with embedded configuration.

## Token Creation Flow

### Backend API Route

**File:** `app/api/gemini/token/route.ts`

**Pattern:**

```typescript
export async function POST(_request: NextRequest) {
  // 1. Get API key from environment (server-side only)
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured' },
      { status: 500 }
    );
  }

  // 2. Initialize GoogleGenAI SDK with server-side key
  const client = new GoogleGenAI({
    apiKey: apiKey  // Never sent to client
  });

  // 3. Create ephemeral token with FULL configuration
  const tokenResponse = await client.authTokens.create({
    config: {
      uses: 1,                           // Single session per token
      expireTime: calculateExpiry(180),  // 3 minutes from now
      newSessionExpireTime: calculateExpiry(180),
      liveConnectConstraints: {
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          systemInstruction: { /* Embedded here */ },
          tools: [ /* Embedded here */ ],
          speechConfig: { /* Embedded here */ },
          // All configuration in the token!
        }
      }
    }
  });

  // 4. Return ONLY the token (not the API key)
  return NextResponse.json({
    token: tokenResponse.name,  // This is safe to send to client
    expiresAt: expireTimeISO
  });
}
```

### Frontend Usage

**File:** `hooks/use-gemini-session.ts`

**Pattern:**

```typescript
const connect = async () => {
  // 1. Fetch ephemeral token from backend
  const response = await fetch('/api/gemini/token', { method: 'POST' });
  const { token } = await response.json();

  // 2. Use token (NOT api key) to connect
  const ai = new GoogleGenAI({
    apiKey: token,  // This is the ephemeral token, not the real API key
    httpOptions: { apiVersion: 'v1alpha' }
  });

  // 3. Connect with minimal config (everything is in token)
  const session = await ai.live.connect({
    model: GEMINI_MODELS.LIVE_FLASH_NATIVE,
    callbacks: { onopen, onmessage, onerror, onclose }
  });
};
```

## Token Configuration

### Lifetime Configuration

**Pattern:**

```typescript
// Calculate expiration times
const now = Date.now();
const expireTime = new Date(now + 180 * 1000).toISOString();  // 180 seconds
const newSessionExpireTime = new Date(now + 180 * 1000).toISOString();

const tokenResponse = await client.authTokens.create({
  config: {
    uses: 1,                            // Critical: single session only
    expireTime: expireTime,             // Token valid for 3 minutes
    newSessionExpireTime: newSessionExpireTime,  // Window to create new session
    // ...
  }
});
```

**Parameters:**

1. **uses: 1**
   - Token can create exactly 1 session
   - After session created, token is invalid
   - Prevents token reuse if leaked

2. **expireTime: 180 seconds**
   - Token expires 3 minutes after creation
   - Even if unused, token becomes invalid
   - Limits damage if token intercepted

3. **newSessionExpireTime: 180 seconds**
   - Window to create new session after token created
   - Shorter = more secure, but worse UX if user slow
   - Current: Same as expireTime (3 min window)

**Why 3 minutes?**
- Long enough for normal user interaction
- Short enough to limit exposure
- Balances security with UX

**Tuning:**
- Shorter (60s): More secure, worse UX
- Longer (600s): Better UX, less secure

### Embedded Configuration

**CRITICAL:** All model configuration is embedded in the token, not sent from client.

**Pattern:**

```typescript
liveConnectConstraints: {
  model: 'gemini-2.5-flash-native-audio-preview-12-2025',
  config: {
    // 1. System instruction (character behavior)
    systemInstruction: {
      parts: [{ text: getSystemInstructionWithContext() }]
    },

    // 2. Response modalities (audio only)
    responseModalities: ['AUDIO'] as any,

    // 3. Speech config (voice selection)
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: 'Iapetus'
        }
      }
    },

    // 4. Realtime input config (server-side VAD)
    realtimeInputConfig: {
      automaticActivityDetection: {
        disabled: false,
        startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH' as any,
        silenceDurationMs: 200
      }
    },

    // 5. Tools (function declarations)
    tools: [{
      functionDeclarations: [
        { name: 'show_menu', description: '...' },
        { name: 'hide_menu', description: '...' },
        { name: 'close_session', description: '...' }
      ]
    }]
  }
}
```

**Why embed in token?**

1. **Security:** Client can't modify system instruction or tools
2. **Consistency:** Same config for all sessions
3. **Efficiency:** Config sent once (in token), not with every message
4. **Immutability:** Client can't tamper with character behavior

**What client CAN'T do:**
- Change system instruction
- Add/remove tools
- Change voice
- Modify VAD settings

**What client CAN do:**
- Send audio (within API limits)
- Receive audio
- Trigger functions (defined in token)
- End session

## Environment Variables

### .env.local Pattern

**File:** `.env.local` (NEVER commit to git)

```bash
GEMINI_API_KEY=your_api_key_here
```

**Access in API route:**

```typescript
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  // Handle missing key gracefully
  return NextResponse.json(
    { error: 'GEMINI_API_KEY not configured' },
    { status: 500 }
  );
}
```

**NEVER:**
```typescript
// ❌ Bad: Hardcoded key
const apiKey = 'AIzaSy...';  // NEVER do this!

// ❌ Bad: Exposed to client
export const config = {
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY  // Exposed to client!
  }
};
```

### Vercel/Production Deployment

**Pattern:**

1. Add environment variable in Vercel dashboard:
   - Key: `GEMINI_API_KEY`
   - Value: (your API key)
   - Scope: Production, Preview, Development

2. Redeploy app (env vars only available after redeploy)

3. Verify in logs:
   ```typescript
   console.log('API key configured:', !!process.env.GEMINI_API_KEY);
   ```

## Error Handling

### Rate Limiting

**Pattern:**

```typescript
try {
  const tokenResponse = await client.authTokens.create({ /* ... */ });
  return NextResponse.json({ token: tokenResponse.name });
} catch (error) {
  // Check for rate limit errors
  if (error instanceof Error) {
    if (error.message.includes('quota') || error.message.includes('rate limit')) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    if (error.message.includes('API key') || error.message.includes('authentication')) {
      return NextResponse.json(
        { error: 'Invalid API key configuration' },
        { status: 401 }
      );
    }
  }

  // Generic error
  return NextResponse.json(
    { error: 'Failed to create ephemeral token' },
    { status: 500 }
  );
}
```

**HTTP Status Codes:**
- **429**: Rate limit exceeded (client should retry with backoff)
- **401**: Authentication failed (API key invalid)
- **500**: Server error (generic)

### Token Expiration

**Client-side handling:**

```typescript
// In use-gemini-session.ts
onerror: (event) => {
  if (event.message?.includes('token') || event.message?.includes('expired')) {
    setError('Session expired. Please refresh the page.');
  } else {
    setError(event.message || 'Connection error');
  }
}
```

**User experience:**
- Show error message
- Suggest page refresh
- Don't auto-refresh (might interrupt user)

## Security Best Practices

### 1. Never Log Sensitive Data

**❌ Bad:**
```typescript
console.log('API key:', apiKey);  // Leaks to logs
console.log('Token:', token);     // Visible in client console
```

**✅ Good:**
```typescript
console.log('API key configured:', !!apiKey);  // Boolean only
console.log('Token created:', token ? 'yes' : 'no');  // No actual token
```

### 2. Validate Environment

**Pattern:**

```typescript
// In API route
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not set in environment');
  return NextResponse.json(
    { error: 'Server configuration error' },
    { status: 500 }
  );
}

// Don't expose exact error to client
// ❌ Bad: return { error: 'GEMINI_API_KEY missing' }
// ✅ Good: return { error: 'Server configuration error' }
```

### 3. CORS and Request Validation

**Pattern:**

```typescript
export async function POST(request: NextRequest) {
  // 1. Verify request origin (optional but recommended)
  const origin = request.headers.get('origin');
  if (origin && !isAllowedOrigin(origin)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  // 2. Rate limit per IP (optional)
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }

  // 3. Create token
  // ...
}
```

### 4. Token Storage

**Client-side:**

**❌ Bad:** Store token in localStorage or cookies

```typescript
localStorage.setItem('gemini_token', token);  // Persists across sessions
```

**✅ Good:** Use token immediately, don't store

```typescript
const { token } = await fetch('/api/gemini/token').then(r => r.json());
const ai = new GoogleGenAI({ apiKey: token });  // Use immediately
// Token discarded after session ends
```

**Why?**
- Tokens expire quickly (3 min)
- Storing increases risk if device compromised
- Single-use tokens prevent reuse anyway

## API Route Configuration

### Runtime: Node.js

**Pattern:**

```typescript
export const runtime = 'nodejs';  // Required for GoogleGenAI SDK
```

**Why nodejs?**
- GoogleGenAI SDK requires Node.js APIs
- Edge runtime doesn't support all features
- Token creation needs server-side crypto

**Alternative:** Could use Edge runtime with fetch API, but GoogleGenAI SDK is more convenient.

### Response Headers

**Pattern:**

```typescript
return NextResponse.json(
  { token: tokenResponse.name },
  {
    headers: {
      'Cache-Control': 'no-store',  // Don't cache tokens
      'Content-Type': 'application/json'
    }
  }
);
```

**Why no-store?**
- Tokens are single-use
- Caching would serve expired tokens
- Each request needs fresh token

## Monitoring and Logging

### Safe Logging Pattern

**Pattern:**

```typescript
// Log token creation (without exposing token)
console.log('[API /api/gemini/token POST] Token created', {
  expiresAt: expireTimeISO,
  model: 'gemini-2.5-flash',
  timestamp: new Date().toISOString()
});

// Log errors (without exposing sensitive data)
console.error('[API /api/gemini/token POST] Error creating token:', {
  error: error instanceof Error ? error.message : 'Unknown error',
  timestamp: new Date().toISOString()
  // Don't log API key or full error stack in production
});
```

### Metrics to Track

**Recommended monitoring:**

1. **Token creation rate**
   - Spike = possible abuse
   - Track per IP for rate limiting

2. **Error rate**
   - High rate = API key issue or quota exceeded
   - Alert on sustained errors

3. **Token expiration rate**
   - Tokens expiring before use = UX issue (too short lifetime)
   - Tokens not expiring = possible leak (investigate)

## Common Security Mistakes to Avoid

### ❌ Exposing API Key

```typescript
// ❌ Bad: Public environment variable
export const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
// NEXT_PUBLIC_ prefix exposes to client!

// ✅ Good: Private environment variable
const apiKey = process.env.GEMINI_API_KEY;  // Server-side only
```

### ❌ Long-Lived Tokens

```typescript
// ❌ Bad: 1 hour expiration
expireTime: calculateExpiry(3600)

// ✅ Good: 3 minutes
expireTime: calculateExpiry(180)
```

### ❌ Reusable Tokens

```typescript
// ❌ Bad: Unlimited uses
uses: 999

// ✅ Good: Single use
uses: 1
```

### ❌ Client-Side Configuration

```typescript
// ❌ Bad: Client can modify config
const session = await ai.live.connect({
  model: GEMINI_MODELS.LIVE_FLASH_NATIVE,
  config: {
    systemInstruction: userProvidedPrompt  // User controls behavior!
  }
});

// ✅ Good: Config embedded in token (server-side)
const session = await ai.live.connect({
  model: GEMINI_MODELS.LIVE_FLASH_NATIVE
  // No config here, all in token
});
```

## Testing Security

### Unit Tests

```typescript
test('API key not exposed in response', async () => {
  const response = await POST(mockRequest);
  const json = await response.json();

  expect(json.token).toBeDefined();
  expect(json.apiKey).toBeUndefined();  // Never expose
  expect(json).not.toHaveProperty('GEMINI_API_KEY');
});

test('Token expires after timeout', async () => {
  const response = await POST(mockRequest);
  const { token, expiresAt } = await response.json();

  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const diffSeconds = (expiryDate.getTime() - now.getTime()) / 1000;

  expect(diffSeconds).toBeCloseTo(180, 5);  // ~180 seconds
});
```

### Integration Tests

```typescript
test('Expired token rejected', async () => {
  // Create token
  const { token } = await fetch('/api/gemini/token', { method: 'POST' })
    .then(r => r.json());

  // Wait for expiration (in test, use short timeout)
  await new Promise(resolve => setTimeout(resolve, 200000));  // 3+ minutes

  // Try to use expired token
  const ai = new GoogleGenAI({ apiKey: token });

  await expect(
    ai.live.connect({ model: GEMINI_MODELS.LIVE_FLASH_NATIVE })
  ).rejects.toThrow(/expired|invalid/);
});
```
