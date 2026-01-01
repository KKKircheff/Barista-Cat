#!/bin/bash

# After-edit hook: TypeScript validation + Documentation reminders
# Only runs when TypeScript files are edited

# Check if TypeScript files were edited
if ! echo "$CLAUDE_EDITED_FILES" | grep -E '\.(ts|tsx)$' > /dev/null; then
    echo "ℹ️  No TypeScript files edited - skipping type-check"
    exit 0
fi

echo "🔍 Running TypeScript validation..."

# Run tsc in the project directory
cd "$(git rev-parse --show-toplevel)" || exit 1

# Run TypeScript compiler with noEmit flag
if npm run type-check 2>&1; then
    echo "✅ TypeScript validation passed"
else
    echo "⚠️  TypeScript validation found errors (non-blocking)"
    echo "Please review and fix when convenient"
fi

# Documentation reminders
echo ""
echo "📚 Documentation reminder:"

if echo "$CLAUDE_EDITED_FILES" | grep -E '^hooks/' > /dev/null; then
    echo "  → Hook files modified - consider updating .claude/rules/hooks-patterns.md"
fi

if echo "$CLAUDE_EDITED_FILES" | grep -E '^components/' > /dev/null; then
    echo "  → Component files modified - consider updating .claude/rules/component-patterns.md"
fi

if echo "$CLAUDE_EDITED_FILES" | grep -E '^lib/audio/' > /dev/null; then
    echo "  → Audio files modified - consider updating .claude/rules/audio-processing.md"
fi

if echo "$CLAUDE_EDITED_FILES" | grep -E '^app/api/' > /dev/null; then
    echo "  → API files modified - consider updating .claude/rules/api-security.md"
fi

if echo "$CLAUDE_EDITED_FILES" | grep -E '^(components/voice-chat|hooks/use-)' > /dev/null; then
    echo "  → Architecture files modified - consider updating docs/architecture.md"
fi

echo ""
echo "✅ Hook complete"
exit 0  # Always exit 0 (non-blocking)
