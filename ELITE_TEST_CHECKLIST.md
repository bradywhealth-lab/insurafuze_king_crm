# Elite Feature Test Checklist

Use this checklist for pre-release smoke testing of elite CRM flows.

## 1) Lead Scraping

- [ ] Open Leads view and trigger "Scrape Leads"
- [ ] Submit a valid target URL with default options
- [ ] Confirm job appears in scrape history
- [ ] Confirm status transitions (pending -> running -> completed/partial/failed)
- [ ] Confirm new leads are created with source `scrape`
- [ ] Confirm duplicate contacts are not re-created as leads

## 2) Social Content + Publishing

- [ ] Generate AI content from Social tab
- [ ] Generate AI media prompt and confirm output renders
- [ ] Save draft content to queue
- [ ] Schedule post with future date/time
- [ ] Run `POST /api/content/publish` for due scheduled content
- [ ] Confirm status updates to `published` when account exists
- [ ] Confirm skip/fail activity logs are created when publish cannot complete

## 3) Follow-Up Automation

- [ ] Create sequence with at least 2 steps
- [ ] Enroll lead via `POST /api/sequences/enroll`
- [ ] Confirm enrollment appears in `GET /api/sequences/enroll`
- [ ] Run `POST /api/sequences/run`
- [ ] Confirm step activity records are created and step index advances
- [ ] Confirm enrollment completes after final step

## 4) AI Learning + Daily Assistant

- [ ] Re-score lead from Leads view / `GET /api/ai/score`
- [ ] Submit feedback to `POST /api/ai/feedback`
- [ ] Load daily assistant via `GET /api/ai/my-day`
- [ ] Validate high-priority leads and meeting cards in dashboard

## 5) Carrier Library

- [ ] Create carrier in Settings
- [ ] Upload brochure/underwriting document
- [ ] Confirm document metadata and list rendering
- [ ] Delete a document and confirm it is removed

## 6) Release Gate

- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] No `.env` or secret files staged in git
