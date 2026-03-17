# Elite CRM — Automation & Workflow Guide

This document explains every automated workflow, what it does, and how to use it.
As a solo developer, these systems act as your QA team, security team, ops team, and on-call engineer.

---

## Table of Contents

1. [GitHub Actions Workflows](#github-actions-workflows)
2. [Operational Scripts](#operational-scripts)
3. [Required Secrets Setup](#required-secrets-setup)
4. [One-Time Setup Checklist](#one-time-setup-checklist)
5. [Day-to-Day Developer Flow](#day-to-day-developer-flow)
6. [Release Process](#release-process)

---

## GitHub Actions Workflows

### 🔵 Code Quality & CI

#### `ci.yml` — Main CI Pipeline
**Triggers:** Every push to any branch; every pull request

Runs three jobs in parallel:
| Job | What it checks | Time |
|-----|---------------|------|
| **Lint** | ESLint 9 — code style and quality | ~30s |
| **Test** | Vitest unit tests — business logic | ~45s |
| **Build** | Next.js production build — compiles cleanly | ~90s |

A summary job `ci-pass` combines all three — configure this as your **required status check** in GitHub branch protection. If any job fails, you get a red × on the commit immediately.

**Secrets required:** None

---

#### `release-gate.yml` — Merge Guard
**Triggers:** PRs targeting `main` only

Runs `scripts/release-gate.mjs` which executes: lint → build → prisma generate → tests — in sequence, stopping on first failure. This is the final gatekeeper before code reaches main.

**Setup:** In GitHub → Settings → Branches → Add rule for `main` → Require status checks → add `Release Gate`.

**Secrets required:** None

---

### 🔴 Security

#### `security.yml` — CodeQL Analysis
**Triggers:** Push to `main`; PRs to `main`; weekly on Mondays at 08:00 UTC

GitHub's CodeQL engine analyzes all TypeScript/JavaScript for:
- SQL injection, XSS, path traversal, prototype pollution
- Insecure cryptography, hardcoded credentials
- SSRF patterns (relevant for `/api/scrape` endpoint)

Results appear in **GitHub → Security → Code Scanning Alerts**. Critical findings also create pull request annotations.

**Secrets required:** None (uses `GITHUB_TOKEN`)

---

#### `dependency-review.yml` — Dependency Safety Gate
**Triggers:** PRs that change `package.json` or `bun.lock`

When you add or update a package, this scans it against the GitHub Advisory Database and OSV. It **fails the PR** if any new dependency has a HIGH or CRITICAL CVE, and warns about problematic licenses (GPL, AGPL).

**Secrets required:** None

---

### 🟡 Maintenance Automation

#### `stale.yml` — Issue & PR Hygiene
**Triggers:** Daily at 01:00 UTC

| What | Stale after | Closed after |
|------|------------|-------------|
| Issues | 30 days | 7 more days |
| PRs | 14 days | 7 more days |

Items with labels `pinned`, `security`, `roadmap`, or `blocked` are never auto-closed. You receive email notifications when items are marked stale — a gentle nudge to either address them or let them close.

**Secrets required:** None

---

#### `auto-label.yml` — PR Auto-Labeling
**Triggers:** PR opened, updated, or reopened

Automatically applies area labels based on which files changed:
- `prisma/**` → `area: database`
- `src/app/api/**` → `area: api`
- `src/app/**/*.tsx` → `area: ui`
- `src/app/api/ai/**` → `area: ai`
- `.github/**` → `area: ci`
- etc. (full config in `.github/labeler.yml`)

**One-time setup:** Run the "Setup Labels" workflow once to create all labels.

**Secrets required:** None

---

#### `setup-labels.yml` — Repository Label Creator
**Triggers:** Manual (`workflow_dispatch`) or when `setup-labels.yml` is pushed to main

Creates all GitHub labels used across workflows. Run this once on a new repository.

**How to run:** GitHub → Actions → "Setup Labels" → Run workflow

---

#### `dependabot.yml` — Automated Dependency Updates
**Triggers:** Weekly on Mondays at 07:00 ET (npm packages + GitHub Actions)

Dependabot opens PRs to update outdated/vulnerable packages. Groups related packages (all `@radix-ui/*` in one PR, all `@tanstack/*` in one PR) to reduce noise. CI runs automatically on Dependabot PRs — review and merge in one click.

Security alerts (CVEs) trigger immediate PRs regardless of schedule.

**Review process:** PR opens → CI passes → review changelog in PR body → merge.

---

### 🟢 Operational Automation

#### `cron-runner.yml` — Sequence & Content Automation
**Triggers:** Every 15 minutes (GitHub cron)

This is your **automation engine**. Every 15 minutes it calls:
1. `POST /api/sequences/run` — processes any sequence steps whose `scheduled_at` is past due (sends follow-up emails/SMS to leads enrolled in sequences)
2. `POST /api/content/publish` — publishes any content posts whose `scheduled_at` has passed

Without this workflow, your sequences and content scheduler never fire. This replaces the need for a cron server.

**Cost:** ~1,440 GitHub Actions minutes/month on a private repo (within the 2,000/month free tier).

**Required secrets:**
- `APP_BASE_URL` — your production app URL
- `INTERNAL_RUNNER_KEY` — must match your app's `.env`
- `RUNNER_ORGANIZATION_ID` — which org's automations to process

---

#### `health-check.yml` — Uptime Monitor
**Triggers:** Every 15 minutes

Hits two endpoints on your production app:
- `GET /api/health` — fast liveness check
- `GET /api/ready` — database connectivity check

If either returns non-200, the workflow **fails** → GitHub emails you immediately. You'll know about outages within ~20 minutes, automatically.

Optional: Set `HEALTH_SLACK_WEBHOOK` secret to also get Slack alerts.

**Required secrets:**
- `APP_BASE_URL`
- `HEALTH_SLACK_WEBHOOK` (optional)

---

### 🟣 Intelligence & Insights

#### `ai-pr-review.yml` — AI Code Reviewer
**Triggers:** PRs opened or updated that touch `src/**`

Posts an AI-generated code review as a PR comment. The reviewer knows the Elite CRM architecture (RLS patterns, `withOrgRlsTransaction`, `getOrgContext`, etc.) and specifically looks for:
- Missing tenant isolation (`organizationId` checks)
- Unhandled async errors
- Missing Zod validation on API inputs
- Security issues in API routes
- Performance anti-patterns (N+1 queries)

The comment is **updated** (not duplicated) on subsequent pushes to the same PR.

Uses GPT-4o-mini (~$0.001-0.01 per review). Skips automatically if no API key is set.

**Required secrets (either one):**
- `OPENAI_API_KEY`

---

#### `schema-drift.yml` — Schema Change Detector
**Triggers:** PRs or pushes that change `prisma/schema.prisma` or migration files

Validates the schema, regenerates the Prisma client, and posts a PR comment reminding you to:
- Create a migration file (`bun run db:migrate`)
- Update `init.sql` and `rls.sql` if tables changed

Catches the #1 database mistake: updating the schema without a migration.

---

#### `performance-audit.yml` — Lighthouse Audit
**Triggers:** PRs to `main` that touch source files; weekly on Mondays

Runs Google Lighthouse against your production URL and reports Performance, Accessibility, Best Practices, and SEO scores as a PR comment. Warns if Performance drops below 50.

**Required secrets:**
- `APP_BASE_URL` (must be a publicly accessible URL)

---

#### `db-backup-check.yml` — Weekly Backup Reminder
**Triggers:** Every Sunday at 06:00 UTC

Creates a GitHub Issue with a backup verification checklist. Also fetches your `/api/stats` endpoint to surface any data anomalies. Keeps a paper trail that you did the check.

Issues are labeled `maintenance` + `database` and auto-managed by the stale workflow.

**Required secrets:**
- `APP_BASE_URL`

---

#### `release.yml` — Release & Changelog Generator
**Triggers:** When you push a version tag (`v1.2.3`)

Generates a structured changelog from commit messages (grouped by Conventional Commits type), creates a GitHub Release, and publishes it. Free, automatic, professional.

**How to trigger:** See [Release Process](#release-process) below.

---

## Operational Scripts

### `scripts/run-internal-runners.mjs`
Calls the sequences and content runner endpoints. Used by the cron workflow and for manual runs.

```bash
bun run runner:tick
# or
node scripts/run-internal-runners.mjs
```

### `scripts/check-env.mjs`
Validates all environment variables are set and not using placeholder values.

```bash
node scripts/check-env.mjs           # warn only
node scripts/check-env.mjs --strict  # exit 1 if required vars missing
```

### `scripts/db-health-check.mjs`
Validates Prisma schema, client generation, and checks for schema drift.

```bash
bun run check:db
```

### `scripts/create-release.mjs`
Creates a semver git tag interactively, auto-detecting the bump type from commits.

```bash
bun run release:create         # auto-detect patch/minor/major
bun run release:create minor   # force minor bump
```

### `scripts/release-gate.mjs`
Full quality gate: lint → build → prisma generate → tests. Called by the release-gate workflow and by the `bun run release-gate` script.

```bash
bun run release-gate
```

### `scripts/apply-init-sql.mjs`
Applies RLS policies from `prisma/rls.sql` to the database.

```bash
bun run db:apply:init
```

---

## Required Secrets Setup

Go to: **GitHub → Your Repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Required for | Example value |
|--------|-------------|---------------|
| `APP_BASE_URL` | Health checks, cron runner, Lighthouse | `https://your-app.example.com` |
| `INTERNAL_RUNNER_KEY` | Cron runner | 32+ char random string |
| `RUNNER_ORGANIZATION_ID` | Cron runner | Your org's CUID from the database |
| `OPENAI_API_KEY` | AI PR review | `sk-proj-...` |
| `HEALTH_SLACK_WEBHOOK` | Slack health alerts (optional) | `https://hooks.slack.com/...` |

All other secrets (Supabase, Linear, etc.) are for application features, not workflows.

---

## One-Time Setup Checklist

After pushing this branch to your repository:

- [ ] **Run "Setup Labels" workflow** — GitHub → Actions → Setup Labels → Run workflow
- [ ] **Add required secrets** — see table above
- [ ] **Enable branch protection on `main`**:
  - GitHub → Settings → Branches → Add rule
  - Branch name pattern: `main`
  - ✅ Require status checks: `CI Pass`, `Release Gate`
  - ✅ Require branches to be up to date
  - ✅ Require conversation resolution before merging
- [ ] **Verify cron runner** — GitHub → Actions → "Operational Cron Runner" → Run workflow → check it runs without error (will warn if `APP_BASE_URL` not set)
- [ ] **Verify health check** — GitHub → Actions → "Health Check" → Run workflow

---

## Day-to-Day Developer Flow

```
1. Create feature branch
   git checkout -b feat/my-feature

2. Make changes, commit with conventional format
   git commit -m "feat(leads): add bulk import from CSV"

3. Push — CI runs automatically
   git push origin feat/my-feature

4. Open PR to main
   - Auto-labeler applies area labels
   - AI code review posts within 2 minutes
   - Release gate runs full quality check
   - Schema drift check posts if you touched the schema

5. Review AI suggestions, fix any issues, push fixes

6. Merge when CI Pass + Release Gate are both green ✅

7. Tag a release when you've accumulated enough changes
   bun run release:create
   git push origin <tag>
   → GitHub Release created automatically with changelog
```

---

## Release Process

```bash
# 1. Ensure you're on main and it's clean
git checkout main && git pull

# 2. Run the release gate locally (sanity check)
bun run release-gate

# 3. Create the release tag (interactive — asks for confirmation)
bun run release:create

# 4. Push the tag — triggers GitHub Release workflow
git push origin v<version>

# 5. Verify the release
# GitHub → Releases → your new release with auto-generated changelog
```

Version strategy:
- `patch` (v1.2.x) — bug fixes only (`fix:` commits)
- `minor` (v1.x.0) — new features (`feat:` commits)
- `major` (vx.0.0) — breaking changes (`feat!:` or `BREAKING CHANGE:` in commit body)
