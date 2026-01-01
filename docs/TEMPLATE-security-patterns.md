# Project-Specific Security Patterns

> **Purpose**: Document security patterns unique to this project
> **Where to use**: Reference this from .claude/rules/api-security.md or docs/security.md

## API Key Management

**[FILL IN: How does this project manage API keys?]**

Example prompts:
- Where are API keys stored? (env vars, secrets manager, etc.)
- How are they rotated?
- Who has access?
- What happens if a key is compromised?

## Authentication & Authorization

**[FILL IN: Authentication mechanism used]**

Prompts:
- What auth system? (OAuth, JWT, session-based, etc.)
- How are users authenticated?
- How are permissions managed?
- What are the authorization levels?

## Compliance Requirements

**[FILL IN: Any compliance requirements (GDPR, HIPAA, SOC2, etc.)]**

Prompts:
- What data protection laws apply?
- What are the data retention policies?
- How is PII handled?
- What are audit requirements?

## Security Checklist

- [ ] Document all environment variables and their purposes
- [ ] List all external API dependencies and auth methods
- [ ] Define rate limiting strategy
- [ ] Document CORS configuration
- [ ] List security headers required
- [ ] Define input validation rules
- [ ] Document encryption at rest/in transit

## Rate Limiting & Abuse Prevention

**[FILL IN: Rate limiting strategy]**

Prompts:
- What are the rate limits?
- How are they enforced? (middleware, API gateway, etc.)
- What happens when limits are exceeded?
- Are there different limits for different user tiers?

## Data Protection

**[FILL IN: How is sensitive data protected?]**

Prompts:
- What data is considered sensitive?
- How is it encrypted at rest?
- How is it encrypted in transit?
- How long is data retained?
- What is the data deletion policy?

## Security Headers

**[FILL IN: Required security headers]**

Example:
```
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000
```

## Input Validation

**[FILL IN: Input validation rules and patterns]**

Prompts:
- What inputs need validation?
- What validation library is used?
- What are the common validation patterns?
- How are validation errors handled?

## Known Security Vulnerabilities to Avoid

**[FILL IN: Project-specific security anti-patterns]**

Examples:
- ❌ Never expose API keys in client code
- ❌ Never trust user input without validation
- ❌ Never store passwords in plain text
- ❌ [Add project-specific vulnerabilities]

---

## After Filling This Out

1. **Rename file**: `docs/TEMPLATE-security-patterns.md` → `docs/security-patterns.md`

2. **Reference from**:
   - `.claude/rules/api-security.md` - Add pointer to this file for detailed security patterns
   - `CLAUDE.md` - List in "Deep Dive Documentation" section

3. **Keep updated**: Review and update this file when security requirements change
