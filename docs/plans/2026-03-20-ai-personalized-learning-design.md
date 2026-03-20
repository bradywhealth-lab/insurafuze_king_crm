# AI Personalized Continuous Learning System

**Date:** 2026-03-20
**Status:** Design Approved
**Author:** AI (Claude)

---

## Overview

Build a comprehensive AI learning system that personalizes for each individual user by learning from their interactions, feedback, and outcomes. The system will continuously improve at:

- **Communication Style:** Learn to write emails, SMS, and scripts in each user's voice
- **What Works:** Track which leads convert, optimal follow-up timing, successful patterns
- **Domain Knowledge:** Accumulate carrier preferences, industry expertise per user
- **Source Intelligence:** Monitor scraping source performance with weekly/monthly reports

---

## Architecture

### Hybrid Data Approach

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Source of Truth | Postgres | All structured data |
| Vector Search | pgvector | Semantic pattern retrieval, embeddings |
| Future Scale | Pinecone/Weaviate | If volume demands |

### Learning Flow

```
User Interaction → Event Capture → Feedback Loop → Pattern Extraction
→ Profile Update → Personalized Generation
```

---

## Data Model

### New Prisma Models

```prisma
// Per-user AI learning profile
model UserAIProfile {
  id             String   @id @default(cuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id])

  // Communication Style (learned from user's outputs)
  writingStyle   Json?    // tone, formality, common phrases, emoji usage
  emailPatterns  Json?    // subject lines, CTAs, structures that work
  smsPatterns    Json?    // successful SMS flows, timing

  // Domain Knowledge (accumulated expertise)
  carrierPreferences Json  // which carriers for which lead types
  industryKnowledge Json   // profession-specific insights
  successfulSources Json   // scraping sites that convert

  // Performance Tracking
  totalInteractions Int    @default(0)
  successfulPredictions Int @default(0)
  lastUpdatedAt    DateTime @default(now())

  // Vector embedding for similarity search
  profileEmbedding Float[]?

  learningHistory UserLearningEvent[]

  @@index([userId])
}

// Track every AI interaction for learning
model UserLearningEvent {
  id             String   @id @default(cuid())
  userProfileId  String
  userProfile    UserAIProfile @relation(fields: [userProfileId], references: [id])

  // Event Details
  eventType      String   // sms_sent, email_sent, lead_scored, playbook_generated
  entityType     String   // lead, carrier, automation
  entityId       String

  // Input (what AI did)
  input          Json     // prompt, context provided
  output         Json     // AI response generated

  // Outcome (what happened)
  outcome        String?  // success, failure, pending
  outcomeDelay   Int?     // minutes until result known

  // User Feedback
  userRating     Int?     // 1-5 or thumbs
  userCorrection Json?    // what user changed

  // Metadata
  leadProfession String?  // industry/role for targeting
  sourceType     String?  // scraping source, referral, etc.

  // For retrieval
  embedding      Float[]?

  createdAt      DateTime @default(now())
  outcomeAt      DateTime?

  @@index([userProfileId])
  @@index([eventType])
  @@index([createdAt])
}

// Scraping performance tracking
model ScrapingSourcePerformance {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  sourceDomain   String
  sourceType     String   // directory, sitemap, manual

  // Performance Metrics
  totalScraped   Int      @default(0)
  leadsCreated   Int      @default(0)
  leadsConverted Int      @default(0)
  conversionRate Float?

  // Quality Signals
  avgLeadScore   Float?
  commonProfessions Json[] // industries found here

  // Trends
  weeklyStats    Json?    // last 12 weeks data
  monthlyStats   Json?    // last 12 months data

  lastScrapedAt  DateTime?
  updatedAt      DateTime @updatedAt

  @@unique([organizationId, sourceDomain])
  @@index([organizationId])
  @@index([conversionRate])
}
```

### Updates to Existing Models

```prisma
model User {
  // ... existing fields
  aiProfile      UserAIProfile?
}

model Organization {
  // ... existing fields
  scrapingPerformance ScrapingSourcePerformance[]
}

model Lead {
  // ... existing fields
  profession      String?  // NEW: Track industry/role
  scrapingSourceId String?  // NEW: Link to source
}
```

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ai/track` | POST | Capture every AI interaction for learning |
| `/api/ai/feedback` | POST | Submit feedback (enhanced to actually use it) |
| `/api/ai/profile` | GET | Get user's learned profile |
| `/api/ai/profile/sync` | POST | Manually trigger profile re-training |
| `/api/ai/reports/weekly` | GET | Weekly performance report |
| `/api/ai/reports/monthly` | GET | Monthly scraping source analysis |
| `/api/ai/generate/personalized` | POST | AI generation using learned profile |
| `/api/scraping/performance` | GET | All scraping source metrics |

---

## Learning Pipeline

### 1. Event Capture (Real-time)
Every AI interaction is logged with input, output, and context.

```typescript
await trackAIEvent({
  userId,
  eventType: 'sms_sent',
  input: { leadId, templateUsed },
  output: { smsText },
  leadProfession: lead.company,
  sourceType: lead.source,
})
```

### 2. Outcome Tracking (Delayed)
When results are known (lead replied, converted, etc.):

```typescript
await recordOutcome({
  eventId,
  outcome: 'success',
  delay: 45 // minutes
})
```

### 3. Pattern Extraction (Weekly - Cron)
Analyze what's working:

```typescript
await extractPatterns({
  userId,
  lookbackDays: 7,
  dimensions: [
    'sms_templates_that_converted',
    'email_subject_lines_with_opens',
    'carrier_matches_for_professions',
    'scraping_sources_by_conversion'
  ]
})
```

### 4. Profile Update (Weekly)
Extracted patterns update the user's AI profile.

### 5. Personalized Generation (On-demand)
AI calls retrieve similar successful patterns via RAG.

---

## Implementation Phases

### Phase 1: Core Infrastructure
- pgvector setup
- New Prisma models
- Event capture system
- `/api/ai/track` endpoint
- Enhanced feedback usage

### Phase 2: Personalized Generation
- Profile endpoints
- RAG retrieval with pgvector
- Update AI routes to use learned patterns
- Profession tracking

### Phase 3: Learning Pipeline
- Pattern extraction jobs
- Weekly/monthly reports
- Scraping source performance tracking
- Background job scheduler

### Phase 4: Analytics & Reporting
- Weekly performance dashboard
- Monthly scraping report
- Admin learning insights

---

## Success Metrics

- **User Engagement:** % of users with active learning profiles
- **Pattern Quality:** % of AI generations using learned patterns
- **Outcome Improvement:** Lift in conversion rates over time
- **Feedback Loop:** % of events with outcome data

---

## Future Enhancements

1. Move to Pinecone/Weaviate if scale demands
2. Fine-tuned models per organization
3. A/B testing framework for pattern variants
4. Automated pattern discovery (unsupervised)
5. Cross-user pattern sharing (opt-in)
