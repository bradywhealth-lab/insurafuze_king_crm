# Live Launch Commands

Date: 2026-03-19
Repo: `/Users/bradywilson/Desktop/z.ai-1st-kingCRM`
Use case: copy-paste runbook to get this app live on Vercel with Postgres and Supabase

## Before You Start

Run everything from this repo:

```bash
cd "/Users/bradywilson/Desktop/z.ai-1st-kingCRM"
pwd
git status -sb
```

Expected:

- working directory is this repo
- worktree is clean or intentionally dirty

## 1. Log In And Link Vercel

```bash
vercel login
vercel whoami
vercel link
```

If the project is already linked:

```bash
vercel link --yes
```

## 2. Define Your Production Values Locally

Replace every placeholder before running the next block.

```bash
export PROD_DOMAIN="https://your-domain.com"
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require'
export INTERNAL_RUNNER_KEY='replace-with-long-random-secret'
export SUPABASE_URL='https://YOURPROJECTREF.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='replace-with-supabase-service-role-key'
export SUPABASE_STORAGE_BUCKET='carrier-documents'
export RUNNER_ORGANIZATION_ID='replace-with-real-org-id'
export OPENAI_API_KEY='replace-with-openai-key'
export ANTHROPIC_API_KEY=''
export GOOGLE_API_KEY=''
export LINEAR_API_KEY=''
export SCRAPINGBEE_API_KEY=''
export SCRAPER_PROXY_URL_TEMPLATE=''
export FIRECRAWL_API_KEY=''
export TRUST_PROXY='0'
```

Sanity-check that the required values are populated:

```bash
for key in PROD_DOMAIN DATABASE_URL INTERNAL_RUNNER_KEY SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_STORAGE_BUCKET RUNNER_ORGANIZATION_ID; do
  eval "value=\${$key}"
  if [ -z "$value" ]; then
    echo "MISSING: $key"
  else
    echo "SET: $key"
  fi
done
```

## 3. Push Production Env Vars To Vercel

These commands add or overwrite the production env vars directly in Vercel:

```bash
vercel env add DATABASE_URL production --value "$DATABASE_URL" --yes --force
vercel env add INTERNAL_RUNNER_KEY production --value "$INTERNAL_RUNNER_KEY" --yes --force
vercel env add SUPABASE_URL production --value "$SUPABASE_URL" --yes --force
vercel env add SUPABASE_SERVICE_ROLE_KEY production --value "$SUPABASE_SERVICE_ROLE_KEY" --yes --force
vercel env add SUPABASE_STORAGE_BUCKET production --value "$SUPABASE_STORAGE_BUCKET" --yes --force
vercel env add RUNNER_ORGANIZATION_ID production --value "$RUNNER_ORGANIZATION_ID" --yes --force
vercel env add APP_BASE_URL production --value "$PROD_DOMAIN" --yes --force
```

Add at least one AI provider key:

```bash
if [ -n "$OPENAI_API_KEY" ]; then vercel env add OPENAI_API_KEY production --value "$OPENAI_API_KEY" --yes --force; fi
if [ -n "$ANTHROPIC_API_KEY" ]; then vercel env add ANTHROPIC_API_KEY production --value "$ANTHROPIC_API_KEY" --yes --force; fi
if [ -n "$GOOGLE_API_KEY" ]; then vercel env add GOOGLE_API_KEY production --value "$GOOGLE_API_KEY" --yes --force; fi
```

Optional integrations:

```bash
if [ -n "$LINEAR_API_KEY" ]; then vercel env add LINEAR_API_KEY production --value "$LINEAR_API_KEY" --yes --force; fi
if [ -n "$SCRAPINGBEE_API_KEY" ]; then vercel env add SCRAPINGBEE_API_KEY production --value "$SCRAPINGBEE_API_KEY" --yes --force; fi
if [ -n "$SCRAPER_PROXY_URL_TEMPLATE" ]; then vercel env add SCRAPER_PROXY_URL_TEMPLATE production --value "$SCRAPER_PROXY_URL_TEMPLATE" --yes --force; fi
if [ -n "$FIRECRAWL_API_KEY" ]; then vercel env add FIRECRAWL_API_KEY production --value "$FIRECRAWL_API_KEY" --yes --force; fi
if [ "$TRUST_PROXY" = "1" ]; then vercel env add TRUST_PROXY production --value "$TRUST_PROXY" --yes --force; fi
```

Pull the Vercel env back down to verify linkage:

```bash
vercel env pull .env.vercel.production
```

## 4. Create The Supabase Storage Bucket

This app uses `getPublicUrl`, so the bucket should be public.

Create the bucket:

```bash
curl -sS -X POST "$SUPABASE_URL/storage/v1/bucket" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$SUPABASE_STORAGE_BUCKET\",\"name\":\"$SUPABASE_STORAGE_BUCKET\",\"public\":true}"
```

List buckets to verify:

```bash
curl -sS "$SUPABASE_URL/storage/v1/bucket" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
```

If the create call returns a conflict because the bucket already exists, that is fine.

## 5. Apply The Production Prisma Schema

Run migrations against the real production database:

```bash
DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy
```

Optional status check:

```bash
DATABASE_URL="$DATABASE_URL" npx prisma migrate status
```

## 6. Run The Local Release Gate One More Time

```bash
npm run release-gate
```

This should already pass based on the current Codex session. Re-run it if you changed anything before deployment.

## 7. Deploy To Vercel Production

```bash
vercel --prod
```

If you want logs inline:

```bash
vercel deploy --prod --logs
```

## 8. Verify Health And Readiness Immediately

```bash
curl -sS "$PROD_DOMAIN/api/health"
curl -i -sS "$PROD_DOMAIN/api/ready"
```

Pass criteria:

- `/api/health` returns JSON with `ok: true`
- `/api/ready` returns HTTP 200
- readiness JSON shows `ready: true`
- readiness JSON shows `database: "ok"`

## 9. Verify Runner Endpoint Security

Without headers, these should fail with `401`:

```bash
curl -i -X POST "$PROD_DOMAIN/api/content/publish"
curl -i -X POST "$PROD_DOMAIN/api/sequences/run"
```

With valid headers, these should succeed:

```bash
curl -i -X POST "$PROD_DOMAIN/api/content/publish" \
  -H "x-internal-runner-key: $INTERNAL_RUNNER_KEY" \
  -H "x-organization-id: $RUNNER_ORGANIZATION_ID" \
  -H "Content-Type: application/json" \
  --data '{"limit":25}'

curl -i -X POST "$PROD_DOMAIN/api/sequences/run" \
  -H "x-internal-runner-key: $INTERNAL_RUNNER_KEY" \
  -H "x-organization-id: $RUNNER_ORGANIZATION_ID" \
  -H "Content-Type: application/json" \
  --data '{}'
```

## 10. Validate The Scheduler Command Against Production

Run the existing scheduler script manually:

```bash
APP_BASE_URL="$PROD_DOMAIN" \
INTERNAL_RUNNER_KEY="$INTERNAL_RUNNER_KEY" \
RUNNER_ORGANIZATION_ID="$RUNNER_ORGANIZATION_ID" \
npm run runner:tick
```

This should call both internal automation routes successfully.

## 11. Final Product Smoke

Run these in production before you call the app live:

1. create or scrape a lead
2. generate content
3. enroll and run a sequence
4. upload a carrier document
5. generate a carrier playbook
6. save the playbook to timeline
7. verify at least one real AI path succeeds end to end

## 12. If You Need A Fast Failure Checklist

If something breaks, check these in order:

### `/api/ready` fails

```bash
echo "$DATABASE_URL"
DATABASE_URL="$DATABASE_URL" npx prisma migrate status
```

Common causes:

- wrong `DATABASE_URL`
- missing production migrations
- database firewall/network issue

### carrier document upload fails

```bash
curl -sS "$SUPABASE_URL/storage/v1/bucket" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
```

Common causes:

- bucket missing
- wrong service role key
- bucket name mismatch

### AI route fails

Check:

- at least one provider key is set in Vercel production env
- the app was redeployed after the env var was added

### runner script fails

Check:

- `APP_BASE_URL` matches the deployed domain exactly
- `RUNNER_ORGANIZATION_ID` exists in prod data
- `INTERNAL_RUNNER_KEY` matches between Vercel and the runner environment

## 13. Launch Decision

Go live only if all of these are true:

- Vercel production deployment succeeded
- `/api/health` is green
- `/api/ready` is green
- Supabase bucket exists
- one carrier document upload works
- one AI flow works
- runner tick works manually
- unauthenticated runner calls return `401`

If all are true, the app is ready to be declared live.
