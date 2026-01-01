# Code Style and Best Practices

## Self-Documenting Code (No Comments)

**CRITICAL:** Write self-explanatory code without comments.

### Why No Comments?

1. **Comments age poorly** - Code changes, comments don't get updated
2. **Self-documenting code is better** - Variable names and function names should explain intent
3. **TypeScript helps** - Type annotations provide context
4. **Code should be the single source of truth**

### How to Write Self-Documenting Code

**Bad (with comments):**
```typescript
const isUserSpeaking = volumeLevel.volumeLevel > INTERRUPTION_VOLUME_THRESHOLD;

if (isUserSpeaking && audioPlayback.isPlayingAudio) {
    audioPlayback.emergencyStop();
}
```

**Good (self-documenting):**
```typescript
const isUserSpeaking = volumeLevel.volumeLevel > INTERRUPTION_VOLUME_THRESHOLD;
const isBartenderSpeaking = audioPlayback.isPlayingAudio;
const shouldInterruptBartender = isUserSpeaking && isBartenderSpeaking;

if (shouldInterruptBartender) {
    audioPlayback.emergencyStop();
}
```

### Exceptions (When Comments Are OK)

1. **Complex algorithms** - If the logic is inherently complex (e.g., audio resampling math)
2. **Critical guardrails** - Security warnings (e.g., "NEVER expose API key")
3. **External constraints** - Explaining why we use specific values (e.g., "Gemini requires 16kHz")
4. **Intentional code smells** - Explaining why something looks wrong but is correct

### Examples from This Codebase

**✅ Good (already follows this):**
- Variable names: `INTERRUPTION_VOLUME_THRESHOLD`, `PRE_BUFFER_COUNT`
- Function names: `emergencyStop()`, `updateSpeechState()`
- Constant names: `START_SENSITIVITY_HIGH`

**❌ Remove these types of comments:**
- Inline comments explaining what code does
- Step comments (Step 1, Step 2, etc.) - use function names instead
- Obvious comments ("Create variable", "Call function")

### Action Items

- Remove existing inline comments in codebase (except critical ones)
- Use descriptive variable/function names
- Extract complex logic into well-named functions

## Documentation Maintenance

**CRITICAL:** Keep documentation up to date when making changes.

### When to Update Documentation

| Change Type | Update These Docs |
|-------------|-------------------|
| New hook created/modified | `.claude/rules/hooks-patterns.md` + `CLAUDE.md` |
| Component pattern changed | `.claude/rules/component-patterns.md` |
| Audio processing changed | `.claude/rules/audio-processing.md` + `docs/audio-pipeline.md` |
| API/security changed | `.claude/rules/api-security.md` + `docs/gemini-live-integration.md` |
| Architecture changed | `docs/architecture.md` + `CLAUDE.md` |
| New major feature | `README.md` + `CLAUDE.md` |

### Progressive Disclosure Principle

Documentation should follow **progressive disclosure**:

1. **CLAUDE.md** - Quick reference, points to detailed docs
2. **docs/*.md** - Deep dives on specific topics
3. **.claude/rules/*.md** - Specific patterns and guardrails

**Example:**

```markdown
# CLAUDE.md (high-level)
- Server-side VAD only
- See docs/vad-system.md for details

# docs/vad-system.md (detailed)
- Configuration options
- How it works
- Troubleshooting
- Performance considerations
```

### Documentation Update Checklist

After making changes, ask yourself:

- [ ] Is there a new pattern others should follow?
- [ ] Did I change existing behavior?
- [ ] Would this confuse someone new to the codebase?
- [ ] Is this a critical guardrail that must be documented?

If **yes** to any → Update relevant docs.
