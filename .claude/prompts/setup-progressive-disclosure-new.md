# Progressive Disclosure Setup - New Project

## When to Use
- After running /init on a new project
- You have a basic CLAUDE.md file
- Project structure is defined but documentation is minimal

## Prerequisites
- Project has package.json
- Basic folder structure exists
- /init has been run

## Expected Outcome
- Slim CLAUDE.md (~2-3KB)
- .claude/rules/ with 3-5 contextual pattern files
- docs/ with 2-4 deep-dive documentation files
- Progressive disclosure structure optimized for your framework

## Estimated Time
10-15 minutes

---

## The Prompt

I just initialized this project with /init. Please set up progressive disclosure optimization:

**Phase 1: Research Latest Features**
Research the latest Claude Code documentation features and best practices:
- Check official Claude Code documentation for hooks, rules, settings
- Look for progressive disclosure patterns and recommendations
- Research current best practices for CLAUDE.md organization
- Identify any new features for documentation management

Summarize your findings before proceeding.

**Phase 2: Analyze Project Structure**
Analyze this project to understand its patterns:
- Identify framework and version from package.json
- Detect folder organization patterns (e.g., components/, hooks/, lib/, api/, etc.)
- Identify tech stack and major dependencies
- Detect 3-5 main code organization patterns in the project

Provide a project analysis report before proposing structure.

**Phase 3: Propose Progressive Disclosure Structure**
Based on your research and analysis, propose a progressive disclosure structure with:

1. **Slim CLAUDE.md** (~2-3KB) containing:
   - Codebase map (stack, entry points, architecture overview)
   - Essential development commands
   - References to contextual rules
   - 5-10 critical guardrails specific to this project
   - Pointers to deep-dive docs

2. **.claude/rules/** directory with 3-5 pattern-specific files:
   - Identify the main code patterns in this project
   - Create rule files for each (e.g., component-patterns.md, api-patterns.md)
   - Include: conventions, best practices, common patterns, anti-patterns to avoid

3. **docs/** directory with deep-dive documentation:
   - architecture.md - Overall architecture and design patterns
   - [framework]-integration.md - Framework-specific implementation details
   - [key-features].md - Deep dives on major systems/features

4. **Documentation Levels**:
   - Level 1: CLAUDE.md (quick reference, map, guardrails)
   - Level 2: .claude/rules/ (contextual patterns for specific file types)
   - Level 3: docs/ (deep technical details on demand)

Show me the proposed file tree and reasoning before implementing.

**Phase 4: Implementation** (after approval)
Create the progressive disclosure structure:
- Use TodoWrite to track progress
- Create files in order: docs/ → .claude/rules/ → restructure CLAUDE.md
- Ensure files use @ syntax for cross-references
- Verify the structure is framework-agnostic and reusable

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
