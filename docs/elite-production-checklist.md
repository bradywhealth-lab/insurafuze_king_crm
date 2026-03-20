# Elite Production Checklist

This is the shortest honest path from "works locally" to "can be trusted in production."

## Done in code

- Dashboard now reads live stats, activities, insights, and AI daily assistant data.
- Pipeline view now reads live pipeline state and persists deal stage moves.
- Added `GET /api/ai/insights` with generated fallback insights when the table is empty.
- Existing hardening remains in place:
  - org-aware request context
  - mutating-route validation
  - in-memory rate limiting
  - internal runner auth for scheduled endpoints
  - carrier document storage + retrieval-backed playbooks

## Must finish in infrastructure before launch

1. Set production secrets:
   - `DATABASE_URL`
   - `OPENAI_API_KEY` or alternate provider keys
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET`
   - `INTERNAL_RUNNER_KEY`
   - `APP_BASE_URL`
   - `RUNNER_ORGANIZATION_ID`
2. Move production database to Postgres and run Prisma deploy flow.
3. Schedule `npm run runner:tick` on a real scheduler.
4. Point domain, TLS, and health checks at `/api/ready` and `/api/health`.
5. Add error monitoring and log shipping.

## Next code priorities after this branch

1. Wire live provider integrations:
   - Twilio for `/api/sms/send`
   - social platform publish APIs for `/api/content/publish`
   - calendar sync for `/api/bookings`
2. Replace in-memory rate limiting with Redis/shared storage.
3. Move scrape/content/sequence runners out of in-process execution into durable workers.
4. Break `src/app/page.tsx` into routed feature modules/components.
5. Add end-to-end smoke coverage for lead import, carrier playbook, pipeline drag, and scheduled publishing.

## Launch smoke test

1. Import a CSV and confirm new leads appear.
2. Open the dashboard and confirm live stats render.
3. Move a deal in Pipeline and confirm it persists after refresh.
4. Upload a carrier doc, generate a playbook, and save it to the timeline.
5. Create scheduled content and run `npm run runner:tick`.
6. Hit `/api/ai/insights`, `/api/stats`, `/api/pipeline`, `/api/ready`, and `/api/health`.
