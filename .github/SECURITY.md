# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Elite CRM, please report it
responsibly by opening a **private** GitHub Security Advisory on this repository
(Settings → Security → Advisories → New draft advisory).

Do **not** open a public issue for security vulnerabilities.

## Supported Versions

Only the latest release on `main` receives security patches.

## Security Practices

- All API routes enforce organization-scoped queries (multi-tenancy).
- Row-Level Security (RLS) policies are defined in `prisma/rls.sql`.
- Internal runner endpoints require `INTERNAL_RUNNER_KEY` authentication.
- Dependencies are scanned weekly by Dependabot and the Dependency Review workflow.
- The CI pipeline runs `npm audit` checks on every PR.
