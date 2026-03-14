# LIVE TODAY RUNBOOK

Date: 2026-03-13
Repo: `/Users/bradywilson/Desktop/z.ai-1st-kingCRM`
Goal: launch safely today with zero ambiguity

## 0) Stop Context Drift (must pass first)

- [ ] In terminal:
  - `cd "/Users/bradywilson/Desktop/z.ai-1st-kingCRM"`
  - `pwd`
  - `git status -sb`
- [ ] Confirm you are operating only from this repo path.
- [ ] If not, stop and fix workspace path before continuing.

## 1) Verify Build Scripts (Prisma-safe for Vercel)

- [ ] Open `package.json` and confirm:
  - `postinstall` includes `prisma generate` OR `build` starts with `prisma generate && ...`
- [ ] Local verification:
  - `npm run build`
- Pass criteria: build completes without Prisma client missing errors.

## 2) Set Production Environment Variables

Set in Vercel Project Settings -> Environment Variables (Production).

- [ ] `DATABASE_URL`
- [ ] `INTERNAL_RUNNER_KEY`
- [ ] `APP_BASE_URL`
- [ ] `RUNNER_ORGANIZATION_ID`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `SUPABASE_STORAGE_BUCKET`
- [ ] At least one AI key used by app (for generate-content path)

Optional:
- [ ] `TRUST_PROXY=1` only if self-hosted behind trusted reverse proxy.

Pass criteria: all required vars present in Production scope.

## 3) Apply Production DB Schema

- [ ] Run with prod env:
  - `npx prisma migrate deploy`
- [ ] Verify readiness:
  - `curl -sS "https://<APP_BASE_URL>/api/ready"`

Pass criteria:
- HTTP 200
- JSON indicates database ready (not skipped, not error).

## 4) Provision Supabase Storage

- [ ] Create bucket named exactly `SUPABASE_STORAGE_BUCKET`.
- [ ] Ensure server-side service role can upload/delete for carrier docs flow.
- [ ] Verify in app by uploading a carrier document and confirming object appears in bucket.

Pass criteria: upload and delete both work from app flow.

## 5) Configure Scheduler / Runners

- [ ] Schedule runner tick every 5-15 minutes (or equivalent automation).
- [ ] Scheduler environment must include:
  - `APP_BASE_URL`
  - `INTERNAL_RUNNER_KEY`
  - `RUNNER_ORGANIZATION_ID`
- [ ] Manual dry run:
  - `export APP_BASE_URL="https://<your-domain>"`
  - `export INTERNAL_RUNNER_KEY="<your-key>"`
  - `export RUNNER_ORGANIZATION_ID="<your-org-id>"`
  - `npm run runner:tick`

Pass criteria: command exits successfully and logs show expected runner execution path.

## 6) Pre-Deploy Local Gate

- [ ] `npm run test`
- [ ] `npm run release-gate`

Pass criteria: both commands pass fully.

## 7) Deploy

- [ ] Push/deploy main path.
- [ ] Validate:
  - `curl -sS "https://<APP_BASE_URL>/api/health"`
  - `curl -sS "https://<APP_BASE_URL>/api/ready"`

Pass criteria:
- `/api/health` returns `{ "ok": true, "timestamp": "..." }`
- `/api/ready` returns healthy DB-ready response.

## 8) Production Smoke (Browser)

Run `ELITE_TEST_CHECKLIST.md` sections 1-7 in production.

Minimum required before launch:
- [ ] Lead scraping works
- [ ] Content generation/publish path works
- [ ] Sequence enroll/run works
- [ ] AI score/feedback/my-day works
- [ ] Carrier upload/delete works
- [ ] Carrier playbook generate + save timeline works
- [ ] Runner auth behavior verified (401 without header, success with header)

## 9) AI Critical Path (Known Risk)

- [ ] Explicitly test the generate-content flow in production.
- [ ] If it fails, fix provider key/model/runtime env immediately and retest.

Pass criteria: generate-content succeeds end-to-end in real prod environment.

## 10) Security Spot Check

- [ ] Without internal header:
  - `curl -s -o /dev/null -w "%{http_code}" -X POST "https://<APP_BASE_URL>/api/content/publish"`
  - `curl -s -o /dev/null -w "%{http_code}" -X POST "https://<APP_BASE_URL>/api/sequences/run"`
- [ ] With internal header/org:
  - `curl -s -o /dev/null -w "%{http_code}" -X POST "https://<APP_BASE_URL>/api/content/publish" -H "x-internal-runner-key: <key>" -H "x-organization-id: <org-id>"`

Pass criteria:
- No-header requests return 401
- Header-authenticated request returns expected 2xx/queue response.

## 11) Product Gate: Account Isolation

Launch decision depends on requirement:
- If sign-in/sign-up + per-user leads isolation is mandatory for launch:
  - [ ] Confirm implemented and tested end-to-end before launch.
- If not implemented yet:
  - [ ] Do not claim full launch complete for multi-user production.

## GO / NO-GO

Go only if all are true:
- [ ] Steps 0 through 10 passed
- [ ] AI generate-content passed in production
- [ ] Account isolation requirement is either complete or explicitly deferred by decision

If any box is unchecked: NO-GO until fixed.
