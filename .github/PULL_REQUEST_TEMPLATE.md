## What does this PR do?

<!-- One paragraph explaining the change and why it was made.
     If this fixes a bug: describe the root cause and the fix.
     If this adds a feature: describe the user-facing behavior. -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that causes existing functionality to change)
- [ ] Refactor (no functional change, code improvement only)
- [ ] Database schema change (added/removed/changed tables or columns)
- [ ] Dependencies update
- [ ] CI/tooling change

## Testing done

<!-- What did you do to verify this works? Be specific.
     "It works" is not sufficient. Example: "Tested creating a lead with AI scoring
     enabled — verified score appears correctly. Tested with missing required fields
     — verified 400 error is returned with correct message." -->

- [ ] `bun run test` passes
- [ ] `bun run lint` passes
- [ ] Manual testing performed (describe below)

**Manual testing steps:**
1. 
2. 

## Checklist

- [ ] My PR title follows the Conventional Commits format (`feat(scope): description`)
- [ ] I've added/updated Zod validation for any new API inputs
- [ ] All DB queries use `withOrgRlsTransaction()` for tenant isolation
- [ ] No hardcoded `organizationId` values (must come from `getOrgContext()`)
- [ ] New environment variables are documented in `.env.example`
- [ ] If schema changed: migration created (`bun run db:migrate`) or `db:push` documented
- [ ] If schema changed: `prisma/init.sql` and `prisma/rls.sql` updated if needed
- [ ] No `console.log` debugging statements left in production code
- [ ] Error responses use `apiError()` from `src/lib/api-error.ts`

## Screenshots / recordings

<!-- For UI changes, paste screenshots or a Loom/video link here. -->

## Related issues

<!-- Link related GitHub issues: "Closes #123" or "Related to #456" -->
