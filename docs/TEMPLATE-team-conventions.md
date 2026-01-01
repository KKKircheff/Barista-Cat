# Team Conventions & Standards

> **Purpose**: Document team-specific conventions not derivable from code
> **Where to use**: Reference from CLAUDE.md or .claude/rules files

## Code Style

**[FILL IN: Team code style preferences beyond linter]**

Prompts:
- Preferred naming conventions (beyond language defaults)
- Comment style and when to use them
- File organization preferences
- Import/export patterns
- Variable/function naming patterns

Example:
```
Naming Conventions:
- React components: PascalCase (e.g., UserProfile.tsx)
- Hooks: camelCase with 'use' prefix (e.g., useAuth.ts)
- Utilities: camelCase (e.g., formatDate.ts)
- Constants: SCREAMING_SNAKE_CASE (e.g., API_BASE_URL)
- Types/Interfaces: PascalCase (e.g., UserData, ApiResponse)

Comments:
- Use JSDoc for public APIs
- Inline comments for complex logic only
- Avoid obvious comments (e.g., // increment i)
- Explain WHY, not WHAT
```

## Git Workflow

**[FILL IN: How does the team use git?]**

Prompts:
- Branch naming convention
- Commit message format
- PR/MR process
- Who reviews what?
- Merge vs rebase policy
- When to squash commits?

Example:
```
Branch Naming:
- feature/short-description
- fix/issue-number-description
- hotfix/critical-bug-description
- chore/maintenance-task

Commit Messages:
Format: <type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore
Examples:
- feat(auth): add OAuth2 login flow
- fix(api): handle timeout errors gracefully
- docs(readme): update installation instructions

PR Process:
1. Create PR with descriptive title
2. Add at least 2 reviewers
3. Wait for CI to pass
4. Address review comments
5. Squash merge to main (keeps history clean)
```

## Review Process

**[FILL IN: Code review expectations]**

Prompts:
- What must be reviewed before merge?
- How thorough should reviews be?
- What are common review feedback patterns?
- When can reviews be skipped?
- What's the approval threshold?

Example:
```
Review Checklist:
- [ ] Code follows style guide
- [ ] Tests are included and passing
- [ ] No console.logs or debugging code
- [ ] No hardcoded values (use env vars)
- [ ] Error handling is appropriate
- [ ] Documentation is updated
- [ ] No security vulnerabilities introduced

Approval Requirements:
- Minor changes (docs, typos): 1 approval
- Features/bug fixes: 2 approvals
- Architecture changes: Team discussion + 3 approvals
- Hotfixes: 1 approval + deploy after merge

Review Turnaround:
- Aim for same-day review
- Urgent PRs: tag in Slack
- Large PRs: break into smaller chunks
```

## Testing Standards

**[FILL IN: Testing expectations]**

Prompts:
- Test coverage requirements
- Types of tests required (unit, integration, e2e)
- When to write tests (before, during, after code?)
- How to mock/stub dependencies
- Testing framework and conventions

Example:
```
Test Coverage:
- Minimum 80% coverage for new code
- 100% coverage for critical paths (auth, payment, etc.)
- Exceptions: UI components (60% acceptable)

Test Types:
- Unit tests: All utility functions, hooks, services
- Integration tests: API endpoints, database interactions
- E2E tests: Critical user flows (login, checkout, etc.)

Test Naming:
describe('ComponentName', () => {
  it('should do something when condition', () => {
    // test
  });
});

Mocking:
- Mock external APIs (use fixtures)
- Mock time-sensitive functions (Date.now, setTimeout)
- Avoid mocking internal modules (test real code)
```

## Deployment & Release

**[FILL IN: How code gets deployed]**

Prompts:
- Deployment process (CI/CD, manual, etc.)
- Environment progression (dev → staging → prod)
- Rollback procedures
- Feature flag usage
- Versioning strategy

Example:
```
Deployment Pipeline:
main branch → CI runs tests → Deploy to staging → Manual QA → Deploy to prod

Environments:
- dev: Latest main branch, auto-deploys on merge
- staging: Pre-production testing, matches prod config
- prod: Production, manual deploy approval required

Release Process:
1. Create release branch (release/v1.2.3)
2. Test in staging
3. Tag release (git tag v1.2.3)
4. Deploy to prod
5. Monitor for issues
6. If issues: Rollback or hotfix

Rollback:
- Vercel: Revert to previous deployment in dashboard
- Database migrations: Run down migrations (careful!)
- Notify team in #engineering channel
```

## Communication

**[FILL IN: Team communication patterns]**

Prompts:
- Where to ask questions (Slack channels, etc.)
- When to create a meeting vs async discussion
- Documentation expectations
- How to escalate issues
- Stand-up format (if applicable)

Example:
```
Channels:
- #engineering: General engineering discussion
- #code-reviews: PR notifications and discussions
- #incidents: Production issues and alerts
- #releases: Deployment announcements

Communication Guidelines:
- Technical questions: #engineering (async preferred)
- Urgent prod issues: #incidents + tag on-call
- Design discussions: Create RFC document first
- 1-on-1 needed: Calendar invite with context

Documentation:
- Update docs/ when adding features
- Update CLAUDE.md if architecture changes
- Add ADRs (Architecture Decision Records) for major decisions
- Keep README.md current
```

## Code Review Feedback Patterns

**[FILL IN: Common review feedback and how to address]**

Example:
```
Common Feedback:
"Consider extracting this into a reusable function"
→ Action: Extract function, write unit test, document usage

"This could be simplified"
→ Action: Simplify logic, add comment if complexity necessary

"Missing error handling"
→ Action: Add try/catch, handle edge cases, log errors

"Not accessible"
→ Action: Add ARIA labels, keyboard navigation, focus management

"Performance concern"
→ Action: Profile code, optimize if needed, document trade-offs
```

## File Organization

**[FILL IN: How to organize files and folders]**

Example:
```
Project Structure:
components/
├── ui/           # Primitive UI components (buttons, inputs)
├── shared/       # Reusable feature components
└── [feature]/    # Feature-specific components

hooks/
├── use-*.ts      # Custom hooks

lib/
├── [domain]/     # Domain-specific utilities
└── utils/        # General utilities

Example:
components/auth/AuthForm.tsx     (feature component)
hooks/use-auth.ts                 (auth hook)
lib/auth/validateEmail.ts        (auth utility)
```

## Dependencies

**[FILL IN: How to manage dependencies]**

Prompts:
- When to add a new dependency?
- How to evaluate libraries?
- Update policy
- Deprecated dependencies

Example:
```
Adding Dependencies:
1. Check if functionality can be implemented in-house (< 50 LOC)
2. Evaluate: Bundle size, maintenance, license, alternatives
3. Discuss in #engineering if >100KB or critical
4. Add to package.json with exact version

Updating:
- Patch updates: Auto-update weekly (Renovate bot)
- Minor updates: Review release notes, test, merge
- Major updates: RFC if breaking changes, plan migration

Avoid:
- Unmaintained packages (>1 year no updates)
- Packages with critical security vulnerabilities
- Duplicates (lodash AND ramda)
```

---

## After Filling This Out

1. **Rename file**: `docs/TEMPLATE-team-conventions.md` → `docs/team-conventions.md`

2. **Reference from**:
   - `CLAUDE.md` - Add critical conventions to "Critical Guardrails" section
   - `.claude/rules/` files - Reference team standards as needed (e.g., code style in component-patterns.md)

3. **Keep updated**:
   - Review quarterly or when team processes change
   - Update after retrospectives
   - Onboard new team members with this doc
