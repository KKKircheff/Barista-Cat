# Progressive Disclosure Setup - Existing Project

## When to Use
- Project already has a CLAUDE.md file
- CLAUDE.md is large (>5KB) or growing unwieldy
- You want to optimize documentation structure

## Prerequisites
- Existing CLAUDE.md file
- Project is documented to some degree

## Expected Outcome
- Optimized CLAUDE.md (65%+ size reduction)
- No information loss (all content preserved)
- .claude/rules/ with contextual pattern files
- docs/ with deep technical details
- Improved maintainability

## Estimated Time
15-20 minutes

---

## The Prompt

I have an existing project with CLAUDE.md. Please optimize it with progressive disclosure:

**Phase 1: Research Latest Features**
Research the latest Claude Code documentation features and best practices:
- Check official Claude Code documentation for hooks, rules, settings
- Look for progressive disclosure patterns and recommendations
- Research current best practices for CLAUDE.md organization
- Identify any new features for documentation management

Summarize your findings before proceeding.

**Phase 2: Analyze Current State**
Analyze the existing documentation and project:
- Read the current CLAUDE.md (note its size and structure)
- Identify the project framework and tech stack
- Detect folder organization patterns
- Identify 3-5 main code organization patterns
- Assess what content can be extracted vs. what must stay in CLAUDE.md

Provide an analysis report showing:
- Current CLAUDE.md size and main sections
- Identified patterns that need contextual rules
- Content that should move to docs/
- Content that should stay in slim CLAUDE.md

**Phase 3: Propose Reorganization Structure**
Based on your research and analysis, propose how to restructure:

1. **Extract from CLAUDE.md into docs/** (preserve all information):
   - architecture.md - Architecture patterns and design decisions
   - [framework]-integration.md - Framework-specific implementation details
   - [key-systems].md - Deep dives on major features
   - Show exactly what content moves where

2. **Create .claude/rules/** with pattern-specific guidance:
   - Create 3-5 rule files based on detected code patterns
   - Extract conventions and patterns from existing CLAUDE.md
   - Add best practices for each pattern type

3. **Restructure CLAUDE.md** as slim index (~2-3KB):
   - Keep: Codebase map, essential commands, critical guardrails
   - Add: References to .claude/rules/ and docs/ files
   - Remove: Detailed explanations (moved to docs/)

4. **Ensure No Information Loss**:
   - Map every section of current CLAUDE.md to its new location
   - Show before/after comparison

Show me the proposed reorganization with file tree and content mapping before implementing.

**Phase 4: Implementation** (after approval)
Restructure the documentation:
- Use TodoWrite to track progress
- Create docs/ files first (preserve content)
- Create .claude/rules/ files (extract patterns)
- Restructure CLAUDE.md last (as slim index)
- Verify no information loss
- Use @ syntax for cross-references

**Optional: Create Template Files for User-Specific Content**

Would you like me to create placeholder template files for content that requires your domain knowledge?

If yes, I'll create in docs/ directory:
- docs/TEMPLATE-security-patterns.md
- docs/TEMPLATE-business-logic.md
- docs/TEMPLATE-team-conventions.md

These files contain structured prompts to help you document:
- Security patterns unique to your project
- Business logic and workflows
- Team conventions and standards

Each template has `[FILL IN: ...]` prompts guiding you on what to add.

**After filling them out:**
1. Remove the `TEMPLATE-` prefix from the filename
2. Reference them from CLAUDE.md or .claude/rules/ as needed
3. They're already in docs/ where they belong!

---

Please start with Phase 1 (Research). Do not proceed to implementation without my approval of the proposed structure.
