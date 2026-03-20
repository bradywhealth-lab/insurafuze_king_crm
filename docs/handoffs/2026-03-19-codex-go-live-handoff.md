# Codex Go-Live Handoff

Date: 2026-03-19
Repo: `/Users/bradywilson/Desktop/z.ai-1st-kingCRM`
Prepared by: Codex
Goal: hand off the current project state with an exact path to production launch now, not “later”

## Executive Summary

The codebase is materially closer to production than a generic scaffold. The current branch already includes:

- production health and readiness routes
- production object storage wiring for carrier documents
- internal-runner auth and scheduler wiring
- release-gate automation
- CI, security, and maintenance workflows

In this Codex session, I verified the local repository state, confirmed the go-live support files exist, and ran the full local release gate successfully:

- `npm run lint` passed
- `npm run typecheck` passed using the current baseline gate
- `npm run build` passed
- `npm run db:generate` passed
- `npm run test` passed
- `npm run release-gate` passed end to end

This means the app is code-ready for a production deployment sequence. It does not mean production is live yet. The remaining work is infrastructure cutover, production secret confirmation, production database/schema application, storage provisioning, scheduler setup, and final smoke testing.

## What Was Accomplished In This Session

### 1. Repo and launch state audit

I validated the current branch/worktree state:

- git worktree is clean
- current branch contains recent deploy-oriented fixes, including `Fix Next 16 deploy blockers`
- the repo already contains:
  - `GO_LIVE_TOMORROW.md`
  - `LIVE_TODAY_RUNBOOK.md`
  - `cursor_sessionhandoff.md`
  - `scripts/release-gate.mjs`
  - `src/app/api/health/route.ts`
  - `src/app/api/ready/route.ts`

### 2. Production-readiness verification

I confirmed these implementation details directly from code:

- `src/app/api/health/route.ts` returns a basic health payload
- `src/app/api/ready/route.ts` performs a database readiness check
- `src/lib/object-storage.ts` uses Supabase object storage and throws in production if storage is unavailable
- `scripts/run-internal-runners.mjs` calls:
  - `POST /api/sequences/run`
  - `POST /api/content/publish`
  - with `x-internal-runner-key` and `x-organization-id`

### 3. Local environment sanity check

I confirmed the local `.env` contains non-placeholder values for the key runtime variables:

- `DATABASE_URL`
- `INTERNAL_RUNNER_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `RUNNER_ORGANIZATION_ID`
- `APP_BASE_URL`

I did not print any secret values.

### 4. Full release gate execution

I ran:

```bash
npm run release-gate
```

Result: passed.

Important release-gate details:

- lint passed
- typecheck gate passed with `12 known baseline TypeScript errors`
- build passed
- Prisma client generation passed
- tests passed

This is good enough for deployment movement, but the typecheck note matters: the project is using a controlled baseline gate rather than zero TypeScript debt.

## What Had Already Been Completed Before This Turn But Is Present Now

This branch already includes meaningful go-live work that should be treated as complete code, pending production verification:

### 1. Deploy and ops hardening

- `GET /api/health`
- `GET /api/ready`
- `.env.example`
- `scripts/release-gate.mjs`
- GitHub CI, dependency review, CodeQL, nightly maintenance, stale, auto-label, and issue triage workflows

### 2. Storage and automation production wiring

- Supabase-backed carrier document storage
- internal-runner authentication
- scheduler runner script via `npm run runner:tick`

### 3. AI and workflow enhancements already on the branch

- carrier playbook API and save-to-timeline route
- lead workflow and carrier-document flows
- sequence/content automation endpoints

## Current Reality: Are We Ready To Go Live?

### Short answer

Yes, the code is ready to move into live deployment now.

### Precise answer

The application is not “fully live” yet because production infrastructure steps still need to be completed and verified. The repo is at the stage where the remaining work is operational cutover, not feature development.

## Exact Next Steps To Get This App Live Now

This is the fastest sane path. The recommended target is:

- hosting: Vercel
- database: managed PostgreSQL
- object storage: Supabase
- scheduler: Vercel Cron, GitHub Actions, Render Cron, or any scheduled runner

If you use a different host, keep the same order.

### Step 1. Lock the production deployment target

Decision:

- Use Vercel for the Next.js app unless there is already an approved self-hosted target.

How to do it:

1. Create or open the production Vercel project for this repo.
2. Connect the GitHub repository.
3. Set the production branch to `main`.

Why this is first:

- The remaining work depends on knowing where production environment variables and build steps will run.

### Step 2. Provision the production PostgreSQL database

How to do it:

1. Create a production Postgres instance.
2. Capture the production connection string.
3. Add that value to the hosting platform as `DATABASE_URL`.

Important:

- Do not let Prisma fall back to SQLite in production.
- This app’s Prisma config falls back to `file:./prisma/dev.db` when `DATABASE_URL` is missing.
- Production must always have `DATABASE_URL` explicitly set.

### Step 3. Load all required production secrets

Set these in the production host:

- `DATABASE_URL`
- `INTERNAL_RUNNER_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `RUNNER_ORGANIZATION_ID`
- `APP_BASE_URL`
- at least one AI provider key:
  - `OPENAI_API_KEY` or
  - `ANTHROPIC_API_KEY` or
  - `GOOGLE_API_KEY`

Optional but probably needed depending on enabled flows:

- `LINEAR_API_KEY`
- `SCRAPINGBEE_API_KEY`
- `SCRAPER_PROXY_URL_TEMPLATE`
- `FIRECRAWL_API_KEY`
- `TRUST_PROXY=1` if self-hosting behind a trusted reverse proxy and not on Vercel

How to do it:

1. Open the host’s environment variables page.
2. Add every required value in the Production environment.
3. Make sure `APP_BASE_URL` exactly matches the public production domain.
4. Make sure `RUNNER_ORGANIZATION_ID` is a real organization id that exists in the production database.

### Step 4. Provision Supabase storage for carrier documents

How to do it:

1. Open the Supabase project tied to `SUPABASE_URL`.
2. Create the bucket named by `SUPABASE_STORAGE_BUCKET`.
3. Confirm the service role key has upload/delete capability.

Why this matters:

- In development, the app can fall back for small files.
- In production, `src/lib/object-storage.ts` throws if storage is unavailable.
- If this bucket is not ready, carrier document upload will break immediately.

### Step 5. Apply the production database schema

How to do it:

Run this against the production environment:

```bash
npx prisma migrate deploy
```

If the database was never initialized and the deployment process is still schema-push based, use the production-safe Prisma path already approved for your environment. The preferred production path is `migrate deploy`, not ad hoc local-only setup.

Verification:

- deployment logs show migration success
- after deploy, `GET /api/ready` returns HTTP 200 with `database: "ok"`

### Step 6. Deploy the app

How to do it:

1. Push `main` if the final desired code is not already on the remote.
2. Trigger the production deployment in the selected host.
3. Watch the build logs for:
   - Prisma client generation
   - successful Next.js build

Why I am comfortable here:

- local `npm run release-gate` already passed
- the app is configured for standalone Next.js output
- the recent branch history includes a deploy-blocker fix for Next 16

### Step 7. Verify the live deployment immediately

Run:

```bash
curl -sS "https://<your-domain>/api/health"
curl -sS "https://<your-domain>/api/ready"
```

Pass criteria:

- `/api/health` returns `ok: true`
- `/api/ready` returns HTTP 200 and `ready: true`
- `database` reports `ok`

If `/api/ready` fails:

- check `DATABASE_URL`
- check database networking/firewall
- check Prisma migration status

### Step 8. Configure the scheduler for automation

The app already includes:

```bash
npm run runner:tick
```

This script calls:

- `/api/sequences/run`
- `/api/content/publish`

How to do it:

1. Create a scheduled job that runs every 5 to 15 minutes.
2. Give that job these environment variables:
   - `APP_BASE_URL`
   - `INTERNAL_RUNNER_KEY`
   - `RUNNER_ORGANIZATION_ID`
3. Run one manual invocation before enabling the schedule.

Manual validation:

```bash
export APP_BASE_URL="https://<your-domain>"
export INTERNAL_RUNNER_KEY="<your-runner-key>"
export RUNNER_ORGANIZATION_ID="<your-org-id>"
npm run runner:tick
```

Pass criteria:

- both internal endpoints respond successfully

### Step 9. Run the minimum production smoke suite

Use `ELITE_TEST_CHECKLIST.md` and verify at least these flows in production:

1. lead creation/scraping
2. content generation and publishing
3. sequence enrollment and runner execution
4. AI scoring / feedback / my-day
5. carrier document upload and delete
6. carrier playbook generation and save to timeline
7. runner security behavior:
   - no key -> `401`
   - valid internal key -> success

This step is mandatory. “Deploy succeeded” is not enough for launch.

### Step 10. Make the launch decision

Go live only if all of these are true:

- production deploy succeeded
- `/api/health` is healthy
- `/api/ready` is healthy
- carrier document upload works against Supabase
- at least one real AI flow works in production
- runner tick works manually
- security check returns `401` without the runner header

If any of those fail, this is a no-go until fixed.

## How To Accomplish The Next Steps Without Thrashing

Use this exact execution order. Do not bounce between UI, code, and infra randomly.

### Phase A. Infrastructure first

1. Create production database
2. Create storage bucket
3. Create host project
4. load production secrets

Reason:

- this eliminates the most common false starts: deploys with missing env, missing storage, or accidental SQLite fallback

### Phase B. Deploy second

1. deploy app
2. run `/api/health`
3. run `/api/ready`

Reason:

- this gives a clean binary checkpoint before touching automation

### Phase C. Automate third

1. configure scheduler
2. run `npm run runner:tick` manually
3. then enable recurring schedule

Reason:

- you want proof that the runner works before you let it run unattended

### Phase D. Product smoke last

1. run the production checklist
2. verify AI path
3. verify uploads
4. verify auth/security on runner endpoints

Reason:

- only after infra and deployment are stable does product validation become meaningful

## Critical Risks Still On The Board

These are not blockers to deployment by themselves, but they are real and should be acknowledged.

### 1. TypeScript debt is gated, not eliminated

The release gate passed with `12 known baseline TypeScript errors`.

Interpretation:

- current process allows known debt
- this is operationally acceptable for launch only if the current baseline is understood and stable
- it is not the same as a zero-error TS codebase

### 2. `next.config.ts` ignores build type errors

The config includes:

- `typescript.ignoreBuildErrors = true`

Interpretation:

- production builds can succeed while TS issues still exist
- the custom typecheck gate is doing the real enforcement

### 3. Storage is mandatory in production

Carrier document storage has a dev fallback, but not a production fallback. Production bucket or credentials misconfiguration will cause immediate user-facing errors in that flow.

### 4. Scheduler durability is external

Automation depends on an external recurring job invoking `npm run runner:tick`. If that is not configured, sequence and content automation will not run on schedule.

## Recommended Immediate Owner Actions

If the goal is “go live now,” the owner should do these in one sitting:

1. open Vercel and production database provider dashboards
2. set all production env vars
3. create the Supabase bucket
4. run `npx prisma migrate deploy`
5. trigger production deploy
6. hit `/api/health` and `/api/ready`
7. run `npm run runner:tick` against production
8. execute `ELITE_TEST_CHECKLIST.md` critical flows
9. decide go/no-go based on those results only

## Best Starting Point For The Next Codex Session

If Codex picks this up next, start here:

1. verify whether production hosting is already configured
2. verify whether `DATABASE_URL`, Supabase, and AI keys are present in production
3. verify whether production migrations were applied
4. verify `/api/health` and `/api/ready`
5. verify scheduler status
6. run the browser-level smoke checklist and document any failing path

## Supporting Files

Use these together:

- `GO_LIVE_TOMORROW.md`
- `LIVE_TODAY_RUNBOOK.md`
- `cursor_sessionhandoff.md`
- `ELITE_TEST_CHECKLIST.md`
- `docs/automation/maintenance-workflows.md`

This document is the current Codex handoff. The two existing runbooks remain valid and should be treated as execution companions, not replaced.
