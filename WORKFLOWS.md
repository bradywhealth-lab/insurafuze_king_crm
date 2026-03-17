# Automated Workflows & Maintenance Guide

> Everything that keeps Elite CRM healthy while you fly solo.

---

## Quick Reference

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| **CI** | Push / PR to `main` | Lint → Test → Prisma check → Build |
| **Dependency Review** | PR + weekly Monday | Blocks PRs with vulnerable deps; weekly `npm audit` |
| **DB Migration Check** | PR touching `prisma/` | Validates schema against live Postgres |
| **PR Automation** | PR opened | Auto-labels by file paths; posts review checklist |
| **Bundle Analysis** | PR to `main` | Compares JS bundle size vs `main`, posts diff comment |
| **Stale Cleanup** | Daily 6 AM UTC | Warns then closes inactive issues/PRs |
| **Release** | Push `v*` tag | Runs release gate, creates GitHub Release with changelog |
| **Code Health** | Weekly Monday 8 AM | Opens issue with codebase stats, TODO count, outdated deps |
| **Lighthouse** | Weekly Monday 10 AM | Boots app, runs Lighthouse, posts perf/a11y/SEO scores |
| **API Health Check** | PR touching `src/app/api/` + weekly Wed | Boots app, curls every endpoint, reports pass/fail |
| **Dependabot** | Weekly Monday | Opens grouped PRs for outdated npm packages + Actions |

---

## Detailed Workflow Descriptions

### 1. CI (`.github/workflows/ci.yml`)

**Purpose:** Your safety net on every commit. Nothing merges to `main` without passing these checks.

**Jobs:**
- **Lint** — runs `eslint .` to catch code-style and import issues.
- **Tests** — runs `vitest run` (unit/integration tests). Tests mock the database, so no Postgres needed.
- **Prisma** — runs `prisma generate` and checks that the generated client matches what's committed.
- **Build** — runs the full production build (depends on the other three passing first). Reports standalone and static asset sizes in the job summary.

**Concurrency:** Only one CI run per branch at a time; new pushes cancel in-progress runs.

---

### 2. Dependency Review (`.github/workflows/dependency-review.yml`)

**Purpose:** Prevents you from accidentally shipping a known-vulnerable package.

**On PRs:**
- Uses GitHub's `dependency-review-action` to diff the dependency graph.
- Blocks the PR if any **high** or **critical** severity vulnerability is introduced.
- Posts a summary comment on the PR.

**Weekly (Monday 9 AM UTC):**
- Runs `npm audit` on `main` and posts results to the workflow summary.
- Catches vulnerabilities that appear in packages you already depend on.

---

### 3. DB Migration Check (`.github/workflows/db-migration-check.yml`)

**Purpose:** Catches schema mistakes before they hit production.

**Triggers:** Only runs on PRs that touch `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/rls.sql`, or `prisma/init.sql`.

**What it does:**
1. Spins up a fresh Postgres 16 service container.
2. Runs `prisma db push` to validate the schema applies cleanly.
3. Runs `prisma generate` to confirm client generation works.
4. Runs `prisma migrate diff` to detect schema drift.
5. Posts the schema diff in the job summary.

---

### 4. PR Automation (`.github/workflows/pr-automation.yml`)

**Purpose:** Saves you from manually labeling PRs and remembering what to check.

**Auto-labeling** (via `.github/labeler.yml`):
- `area: database` — changes to `prisma/**`
- `area: api` — changes to `src/app/api/**`
- `area: ui` — changes to `src/components/**` or page files
- `area: ai` — changes to AI-related code
- `area: automation` — changes to sequences/content/runners
- `area: carriers` — changes to carrier routes
- `area: config` — config file changes
- `area: ci` — workflow changes
- `dependencies` — package.json / lockfile changes

**Review checklist:** On PR open, a bot comment appears with a contextual checklist based on which files changed (DB items for schema changes, API items for route changes, UI items for component changes, etc.).

---

### 5. Bundle Analysis (`.github/workflows/bundle-analysis.yml`)

**Purpose:** Prevents bundle size regressions. As a solo dev, you won't always notice when a new import adds 200 KB.

**How it works:**
1. Builds the PR branch.
2. Checks out `main` and builds that too.
3. Compares standalone size, static assets, and total JS.
4. Posts (or updates) a comment on the PR with a table showing the delta.

---

### 6. Stale Cleanup (`.github/workflows/stale.yml`)

**Purpose:** Keeps your issue tracker clean without manual triage.

**Rules:**
- Issues inactive for **30 days** get a "stale" warning; closed after **7 more days**.
- PRs inactive for **14 days** get a warning; closed after **7 more days**.
- Issues labeled `keep-open`, `bug`, or `critical` are exempt.
- PRs labeled `keep-open` or `wip` are exempt.

Runs daily at 6 AM UTC. Also available via manual dispatch.

---

### 7. Release (`.github/workflows/release.yml`)

**Purpose:** One-command releases with auto-generated changelogs.

**How to release:**
```bash
# Bump the version in package.json, then:
git tag v0.3.0
git push origin v0.3.0
```

**What happens:**
1. Full release gate (lint + test + build) runs first.
2. Generates a changelog by comparing commits since the last release tag.
3. Groups commits into Features / Fixes / Maintenance / Other (based on conventional commit prefixes).
4. Creates a GitHub Release. Tags containing `-` (e.g., `v0.3.0-beta.1`) are marked as pre-releases.

**Commit message convention:** Use prefixes for automatic categorization:
- `feat:` — new features
- `fix:` — bug fixes
- `chore:` — maintenance
- `docs:`, `refactor:`, `perf:`, `test:`, `ci:` — grouped under "Other"

---

### 8. Code Health Report (`.github/workflows/codehealth.yml`)

**Purpose:** Weekly pulse check on the codebase so tech debt doesn't sneak up on you.

**Reports:**
- Total TypeScript lines, test files, API routes, and components.
- Count of `TODO`, `FIXME`, `HACK`, and `XXX` markers in `src/`.
- Top 10 largest files (split candidates).
- Outdated dependency list.
- Latest test run results.

**Delivery:** Opens a GitHub issue labeled `maintenance` + `automated` every Monday at 8 AM UTC. Review it, take action, close it.

---

### 9. Lighthouse Audit (`.github/workflows/lighthouse.yml`)

**Purpose:** Automated performance and accessibility monitoring.

**What it does:**
1. Spins up Postgres, pushes schema, seeds data.
2. Builds and starts the production server.
3. Runs Lighthouse against `http://localhost:3000`.
4. Opens a GitHub issue with scores for Performance, Accessibility, Best Practices, and SEO.

Runs weekly Monday at 10 AM UTC.

---

### 10. API Health Check (`.github/workflows/api-health.yml`)

**Purpose:** Catches broken API routes before they reach production.

**Triggers:**
- PRs that touch `src/app/api/**`, `src/lib/**`, or `prisma/**`.
- Weekly on Wednesday (catches drift even without code changes).

**What it does:**
1. Spins up Postgres, pushes schema, seeds data.
2. Builds and starts the production server.
3. Curls every API endpoint and checks for expected HTTP status codes.
4. Posts a pass/fail table in the job summary.

Currently smoke-tests: `/api/health`, `/api/ready`, `/api/stats`, `/api/leads`, `/api/pipeline`, `/api/carriers`, `/api/sequences`, `/api/content`, `/api/activities`, `/api/ai`, `/api/bookings`.

---

### 11. Dependabot (`.github/dependabot.yml`)

**Purpose:** Keeps dependencies fresh with minimal effort.

**Schedule:** Weekly on Monday mornings.

**Grouping** (reduces PR noise):
- **Radix UI** — all `@radix-ui/*` minor/patch updates in one PR.
- **TanStack** — all `@tanstack/*` updates in one PR.
- **Prisma** — `prisma` + `@prisma/*` in one PR (they version together).
- **Types** — all `@types/*` updates in one PR.

Also watches for GitHub Actions version updates.

---

## Supporting Files

| File | Purpose |
|------|---------|
| `.github/labeler.yml` | Label-to-glob mapping for PR auto-labeling |
| `.github/dependabot.yml` | Dependabot configuration (npm + GitHub Actions) |
| `.github/PULL_REQUEST_TEMPLATE.md` | Default PR description template with checklist |
| `.github/ISSUE_TEMPLATE/bug_report.yml` | Structured bug report form |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Structured feature request form |
| `.github/ISSUE_TEMPLATE/maintenance.yml` | Tech debt / maintenance task form |
| `.github/SECURITY.md` | Security policy and vulnerability reporting |

---

## Maintenance Calendar

| Day | What runs automatically |
|-----|------------------------|
| **Daily** | Stale issue/PR cleanup (6 AM UTC) |
| **Monday** | Dependabot PRs, Dependency audit (9 AM), Code Health report (8 AM), Lighthouse (10 AM) |
| **Wednesday** | API health check (7 AM) |
| **Every push/PR** | CI (lint, test, prisma, build) |
| **PR to main** | Dependency review, Bundle analysis, PR auto-label + checklist |
| **PR touching prisma/** | DB migration check |
| **PR touching api/** | API smoke tests |
| **Version tag push** | Release with changelog |

---

## How to Use

### Day-to-day development
1. Push to a branch or open a PR → CI runs automatically.
2. Review the auto-generated checklist comment on your PR.
3. Check bundle size comment if you added new dependencies.
4. Merge when all checks pass.

### Releasing a new version
```bash
# 1. Make sure main is clean
git checkout main && git pull

# 2. Update version in package.json
bun version patch  # or minor, major

# 3. Tag and push
git tag v$(node -p "require('./package.json').version")
git push origin main --tags
```

### Weekly review
1. Check the Code Health issue for TODO trends and outdated deps.
2. Review Lighthouse scores — address any red/orange categories.
3. Merge or close Dependabot PRs.
4. Glance at stale items that got auto-closed.

### Adding a new API route
The API Health Check workflow automatically tests new routes **only if** you add them to the `check()` calls in `.github/workflows/api-health.yml`. When you create a new route, add a line:
```bash
check "MyNewRoute" GET "http://localhost:3000/api/my-new-route" 200
```

---

## Secrets Required

All workflows work without secrets for public repos. For private repos or enhanced functionality:

| Secret | Used by | Required? |
|--------|---------|-----------|
| `GITHUB_TOKEN` | All workflows (auto-provided) | Automatic |

No external secrets are needed — all workflows use the auto-provided `GITHUB_TOKEN`. The API Health Check and Lighthouse workflows use placeholder env vars for Supabase/AI keys (the app starts fine without real keys; those features just degrade gracefully).
