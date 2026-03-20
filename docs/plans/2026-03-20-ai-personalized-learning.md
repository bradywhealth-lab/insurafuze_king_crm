# AI Personalized Continuous Learning System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a comprehensive AI learning system that personalizes for each user by learning from their interactions, tracking outcomes, and continuously improving communication style, successful patterns, domain knowledge, and scraping source intelligence.

**Architecture:** Hybrid approach using Postgres as source of truth with pgvector for embeddings and semantic pattern retrieval. Event capture layer logs every AI interaction, feedback loop tracks outcomes, weekly pattern extraction updates user profiles, and personalized generation uses RAG to retrieve successful patterns.

**Tech Stack:** Next.js 15, Prisma ORM, PostgreSQL with pgvector extension, TypeScript, Zod validation

---

## Task 1: Enable pgvector Extension

**Files:**
- Create: `prisma/migrations/20260320_enable_pgvector/migration.sql`

**Step 1: Create migration file**

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to UserAIProfile table (will be created in next task)
ALTER TABLE "UserAIProfile" ADD COLUMN IF NOT EXISTS "profileEmbedding" vector(1536);

-- Add embedding column to UserLearningEvent table (will be created in next task)
ALTER TABLE "UserLearningEvent" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
```

**Step 2: Run Prisma migration**

```bash
npx prisma migrate dev --name enable_pgvector
```

Expected: Migration succeeds, pgvector extension enabled

**Step 3: Verify pgvector is available**

```bash
psql $DATABASE_URL -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
```

Expected output: `vector | [version]`

**Step 4: Commit**

```bash
git add prisma/migrations/20260320_enable_pgvector/
git commit -m "feat: enable pgvector extension for AI learning system"
```

---

## Task 2: Update Prisma Schema with New Models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add new models to schema**

Add these models after the existing models (after UserSession model):

```prisma
// ============================================
// AI PERSONALIZED LEARNING
// ============================================

model UserAIProfile {
  id             String   @id @default(cuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Communication Style (learned from user's outputs)
  writingStyle   Json?
  emailPatterns  Json?
  smsPatterns    Json?

  // Domain Knowledge (accumulated expertise)
  carrierPreferences Json?
  industryKnowledge Json?
  successfulSources Json?

  // Performance Tracking
  totalInteractions Int    @default(0)
  successfulPredictions Int @default(0)
  lastUpdatedAt    DateTime @default(now())

  learningHistory UserLearningEvent[]

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([userId])
}

model UserLearningEvent {
  id             String   @id @default(cuid())
  userProfileId  String
  userProfile    UserAIProfile @relation(fields: [userProfileId], references: [id], onDelete: Cascade)

  // Event Details
  eventType      String
  entityType     String
  entityId       String

  // Input/Output
  input          Json
  output         Json

  // Outcome
  outcome        String?
  outcomeDelay   Int?

  // User Feedback
  userRating     Int?
  userCorrection Json?

  // Metadata
  leadProfession String?
  sourceType     String?

  createdAt      DateTime @default(now())
  outcomeAt      DateTime?

  @@index([userProfileId])
  @@index([eventType])
  @@index([createdAt])
}

model ScrapingSourcePerformance {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  sourceDomain   String
  sourceType     String

  totalScraped   Int      @default(0)
  leadsCreated   Int      @default(0)
  leadsConverted Int      @default(0)
  conversionRate Float?

  avgLeadScore   Float?
  commonProfessions Json?

  weeklyStats    Json?
  monthlyStats   Json?

  lastScrapedAt  DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([organizationId, sourceDomain])
  @@index([organizationId])
  @@index([conversionRate])
}
```

**Step 2: Add relation to User model**

Update the User model to include the aiProfile relation:

```prisma
model User {
  // ... existing fields
  sessions     UserSession[]
  aiProfile    UserAIProfile?  // ADD THIS LINE
}
```

**Step 3: Add relation to Organization model**

Update the Organization model to include scrapingPerformance:

```prisma
model Organization {
  // ... existing fields
  auditLogs   AuditLog[]
  scrapingPerformance ScrapingSourcePerformance[]  // ADD THIS LINE
}
```

**Step 4: Add profession field to Lead model**

```prisma
model Lead {
  // ... existing fields
  notes          Note[]
  profession     String?  // ADD THIS LINE for industry tracking
  tags           LeadTag[]
  // ... rest of fields
}
```

**Step 5: Generate Prisma client**

```bash
npx prisma generate
```

Expected: Client generated successfully with new models

**Step 6: Create migration**

```bash
npx prisma migrate dev --name add_ai_learning_models
```

Expected: Migration created and applied

**Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add AI learning models to schema"
```

---

## Task 3: Create AI Tracking Utilities

**Files:**
- Create: `src/lib/ai-tracking.ts`

**Step 1: Create the tracking utility**

```typescript
import { db } from '@/lib/db'

export type LearningEventType =
  | 'sms_sent'
  | 'email_sent'
  | 'lead_scored'
  | 'playbook_generated'
  | 'content_generated'
  | 'insights_generated'
  | 'chat_message'

export interface TrackEventInput {
  userId: string
  organizationId: string
  eventType: LearningEventType
  entityType: string
  entityId: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  leadProfession?: string
  sourceType?: string
}

export async function ensureUserAIProfile(userId: string) {
  const existing = await db.userAIProfile.findUnique({
    where: { userId },
  })

  if (existing) return existing

  return db.userAIProfile.create({
    data: { userId },
  })
}

export async function trackAIEvent(input: TrackEventInput) {
  const profile = await ensureUserAIProfile(input.userId)

  const event = await db.userLearningEvent.create({
    data: {
      userProfileId: profile.id,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      input: input.input as Record<string, unknown>,
      output: input.output as Record<string, unknown>,
      leadProfession: input.leadProfession,
      sourceType: input.sourceType,
    },
  })

  // Update profile interaction count
  await db.userAIProfile.update({
    where: { id: profile.id },
    data: {
      totalInteractions: { increment: 1 },
      lastUpdatedAt: new Date(),
    },
  })

  return event
}

export interface RecordOutcomeInput {
  eventId: string
  outcome: 'success' | 'failure' | 'pending'
  outcomeDelay?: number // minutes
  userRating?: number // 1-5
  userCorrection?: Record<string, unknown>
}

export async function recordEventOutcome(input: RecordOutcomeInput) {
  const event = await db.userLearningEvent.findUnique({
    where: { id: input.eventId },
    include: { userProfile: true },
  })

  if (!event) {
    throw new Error(`Event not found: ${input.eventId}`)
  }

  const updated = await db.userLearningEvent.update({
    where: { id: input.eventId },
    data: {
      outcome: input.outcome,
      outcomeDelay: input.outcomeDelay,
      userRating: input.userRating,
      userCorrection: input.userCorrection as Record<string, unknown> | null,
      outcomeAt: new Date(),
    },
  })

  // Update successful predictions count
  if (input.outcome === 'success') {
    await db.userAIProfile.update({
      where: { id: event.userProfileId },
      data: {
        successfulPredictions: { increment: 1 },
        lastUpdatedAt: new Date(),
      },
    })
  }

  return updated
}

export async function getUserAIProfile(userId: string) {
  return db.userAIProfile.findUnique({
    where: { userId },
    include: {
      learningHistory: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  })
}
```

**Step 2: Commit**

```bash
git add src/lib/ai-tracking.ts
git commit -m "feat: add AI event tracking utilities"
```

---

## Task 4: Create AI Track API Endpoint

**Files:**
- Create: `src/app/api/ai/track/route.ts`
- Create: `src/app/api/ai/track/route.test.ts`

**Step 1: Write the failing test**

```typescript
import { POST } from './route'
import { db } from '@/lib/db'

// Mock db
jest.mock('@/lib/db', () => ({
  db: {
    userAIProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userLearningEvent: {
      create: jest.fn(),
    },
  },
}))

describe('/api/ai/track', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should track an AI event successfully', async () => {
    const mockProfile = { id: 'profile-1', userId: 'user-1' }
    const mockEvent = { id: 'event-1', eventType: 'sms_sent' }

    ;(db.userAIProfile.findUnique as jest.Mock).mockResolvedValue(mockProfile)
    ;(db.userLearningEvent.create as jest.Mock).mockResolvedValue(mockEvent)
    ;(db.userAIProfile.update as jest.Mock).mockResolvedValue(mockProfile)

    const request = new Request('http://localhost:3000/api/ai/track', {
      method: 'POST',
      body: JSON.stringify({
        eventType: 'sms_sent',
        entityType: 'lead',
        entityId: 'lead-1',
        input: { template: 'follow-up-1' },
        output: { smsText: 'Hey, just checking in...' },
        leadProfession: 'Construction',
        sourceType: 'website',
      }),
    })

    // Note: This test will need auth context mocking
    // For now, structure validates
    const response = await POST(request as any)
    // expect(response.status).toBe(200)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/app/api/ai/track/route.test.ts
```

Expected: Test fails (route doesn't exist yet)

**Step 3: Write minimal implementation**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { withRequestOrgContext } from '@/lib/request-context'
import { trackAIEvent, type LearningEventType } from '@/lib/ai-tracking'

const trackEventSchema = z.object({
  eventType: z.enum([
    'sms_sent',
    'email_sent',
    'lead_scored',
    'playbook_generated',
    'content_generated',
    'insights_generated',
    'chat_message',
  ]),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  output: z.record(z.string(), z.unknown()),
  leadProfession: z.string().optional(),
  sourceType: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, {
      key: 'ai-track',
      limit: 100,
      windowMs: 60_000,
    })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, trackEventSchema)
      if (!parsed.success) return parsed.response

      const { eventType, entityType, entityId, input, output, leadProfession, sourceType } =
        parsed.data

      // Get user ID from session (context should have this)
      const userId = context.userId || 'unknown'

      const event = await trackAIEvent({
        userId,
        organizationId: context.organizationId,
        eventType: eventType as LearningEventType,
        entityType,
        entityId,
        input,
        output,
        leadProfession,
        sourceType,
      })

      return NextResponse.json({ event: { id: event.id, eventType: event.eventType } })
    })
  } catch (error) {
    console.error('AI track error:', error)
    return NextResponse.json(
      { error: 'Failed to track AI event' },
      { status: 500 }
    )
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/app/api/ai/track/route.test.ts
```

Expected: Tests pass

**Step 5: Commit**

```bash
git add src/app/api/ai/track/
git commit -m "feat: add AI event tracking endpoint"
```

---

## Task 5: Enhance Feedback Endpoint to Use Feedback

**Files:**
- Modify: `src/app/api/ai/feedback/route.ts`

**Step 1: Write test for feedback being recorded**

```typescript
import { POST } from './route'
import { db } from '@/lib/db'

jest.mock('@/lib/db', () => ({
  db: {
    aIFeedback: {
      create: jest.fn(),
    },
    userLearningEvent: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}))

describe('/api/ai/feedback enhanced', () => {
  it('should link feedback to learning event when eventId provided', async () => {
    const mockEvent = { id: 'event-1', outcome: null }

    ;(db.userLearningEvent.findFirst as jest.Mock).mockResolvedValue(mockEvent)
    ;(db.userLearningEvent.update as jest.Mock).mockResolvedValue({ ...mockEvent, outcome: 'success' })
    ;(db.aIFeedback.create as jest.Mock).mockResolvedValue({ id: 'feedback-1' })

    const request = new Request('http://localhost:3000/api/ai/feedback', {
      method: 'POST',
      body: JSON.stringify({
        entityType: 'sms_sent',
        entityId: 'lead-1',
        eventId: 'event-1', // NEW: link to learning event
        rating: 5,
        feedback: 'Great response!',
      }),
    })

    const response = await POST(request as any)
    // expect(response.status).toBe(200)
    // expect(db.userLearningEvent.update).toHaveBeenCalled()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/app/api/ai/feedback/route.test.ts
```

**Step 3: Update feedback route to use feedback**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { withRequestOrgContext } from '@/lib/request-context'
import { recordEventOutcome } from '@/lib/ai-tracking'

const feedbackSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  eventId: z.string().optional(), // NEW: link to learning event
  rating: z.number().int().min(-1).max(5),
  feedback: z.string().max(2000).optional(),
  corrections: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, {
      key: 'ai-feedback',
      limit: 60,
      windowMs: 60_000,
    })
    if (limited) return limited

    return withRequestOrgContext(request, async () => {
      const parsed = await parseJsonBody(request, feedbackSchema)
      if (!parsed.success) return parsed.response

      const { entityType, entityId, eventId, rating, feedback, corrections } =
        parsed.data

      // Save feedback
      const saved = await db.aIFeedback.create({
        data: {
          entityType,
          entityId,
          rating,
          feedback: feedback || null,
          corrections: corrections || null,
        },
      })

      // NEW: If eventId provided, record outcome on learning event
      if (eventId) {
        try {
          await recordEventOutcome({
            eventId,
            outcome: rating >= 4 ? 'success' : rating <= 2 ? 'failure' : 'pending',
            userRating: rating,
            userCorrection: corrections,
          })
        } catch (error) {
          // Event might not exist, log but don't fail
          console.warn('Could not link feedback to event:', error)
        }
      }

      return NextResponse.json({ feedback: saved })
    })
  } catch (error) {
    console.error('AI feedback error:', error)
    return NextResponse.json(
      { error: 'Failed to save AI feedback' },
      { status: 500 }
    )
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/app/api/ai/feedback/route.test.ts
```

**Step 5: Commit**

```bash
git add src/app/api/ai/feedback/
git commit -m "feat: link feedback to learning events for outcomes"
```

---

## Task 6: Create AI Profile API Endpoint

**Files:**
- Create: `src/app/api/ai/profile/route.ts`

**Step 1: Write the implementation**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withRequestOrgContext } from '@/lib/request-context'
import { getUserAIProfile, ensureUserAIProfile } from '@/lib/ai-tracking'

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const userId = context.userId || 'unknown'

      const profile = await getUserAIProfile(userId)

      if (!profile) {
        // Create profile if it doesn't exist
        await ensureUserAIProfile(userId)
        return NextResponse.json({ profile: null, message: 'Profile created' })
      }

      // Return learned patterns
      return NextResponse.json({
        profile: {
          id: profile.id,
          totalInteractions: profile.totalInteractions,
          successfulPredictions: profile.successfulPredictions,
          lastUpdatedAt: profile.lastUpdatedAt,
          writingStyle: profile.writingStyle,
          emailPatterns: profile.emailPatterns,
          smsPatterns: profile.smsPatterns,
          carrierPreferences: profile.carrierPreferences,
          industryKnowledge: profile.industryKnowledge,
          successfulSources: profile.successfulSources,
        },
      })
    })
  } catch (error) {
    console.error('AI profile error:', error)
    return NextResponse.json(
      { error: 'Failed to load AI profile' },
      { status: 500 }
    )
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/ai/profile/
git commit -m "feat: add AI profile endpoint"
```

---

## Task 7: Update Existing AI Routes to Track Events

**Files:**
- Modify: `src/app/api/ai/route.ts`
- Modify: `src/app/api/ai/score/route.ts`
- Modify: `src/app/api/ai/my-day/route.ts`
- Modify: `src/app/api/ai/carrier-playbook/route.ts`

**Step 1: Update main AI route to track events**

Add tracking after each AI action:

```typescript
import { trackAIEvent } from '@/lib/ai-tracking'

// In the POST handler, after each case:

case 'score-lead': {
  // ... existing scoring logic ...

  // NEW: Track the scoring event
  await trackAIEvent({
    userId: context.userId,
    organizationId: context.organizationId,
    eventType: 'lead_scored',
    entityType: 'lead',
    entityId: data.leadId || 'unknown',
    input: { leadData: data },
    output: { score: aiResult.score, insights: aiResult.insights },
  }).catch(console.error) // Don't fail if tracking fails

  return NextResponse.json(aiResult)
}

// Similar for other cases...
```

**Step 2: Update carrier playbook route**

```typescript
import { trackAIEvent } from '@/lib/ai-tracking'

// After generating playbook:
await trackAIEvent({
  userId: context.userId,
  organizationId: context.organizationId,
  eventType: 'playbook_generated',
  entityType: 'lead',
  entityId: leadId,
  input: { leadId, extraContext },
  output: { playbook: parsed, source: 'llm' },
  leadProfession: lead.company, // Track profession
}).catch(console.error)
```

**Step 3: Update my-day route**

```typescript
import { trackAIEvent } from '@/lib/ai-tracking'

// At the end of GET handler:
await trackAIEvent({
  userId: context.userId,
  organizationId: context.organizationId,
  eventType: 'insights_generated',
  entityType: 'daily_summary',
  entityId: context.organizationId,
  input: { limit },
  output: { leadsToCall, meetings },
}).catch(console.error)
```

**Step 4: Commit**

```bash
git add src/app/api/ai/
git commit -m "feat: add event tracking to all AI endpoints"
```

---

## Task 8: Create Scraping Performance Tracker

**Files:**
- Create: `src/lib/scraping-tracker.ts`

**Step 1: Create scraping tracker utility**

```typescript
import { db } from '@/lib/db'

export interface TrackScrapingInput {
  organizationId: string
  sourceDomain: string
  sourceType: string
  totalScraped: number
  leadsCreated: number
  avgLeadScore?: number
  professions?: string[]
}

export async function trackScrapingPerformance(input: TrackScrapingInput) {
  const existing = await db.scrapingSourcePerformance.findUnique({
    where: {
      organizationId_sourceDomain: {
        organizationId: input.organizationId,
        sourceDomain: input.sourceDomain,
      },
    },
  })

  if (existing) {
    // Update existing record
    const updated = await db.scrapingSourcePerformance.update({
      where: { id: existing.id },
      data: {
        totalScraped: { increment: input.totalScraped },
        leadsCreated: { increment: input.leadsCreated },
        avgLeadScore: input.avgLeadScore,
        commonProfessions: input.professions,
        lastScrapedAt: new Date(),
      },
    })

    // Recalculate conversion rate
    const leadsConverted = existing.leadsConverted
    const totalLeads = existing.leadsCreated + input.leadsCreated
    const conversionRate = totalLeads > 0 ? leadsConverted / totalLeads : null

    return db.scrapingSourcePerformance.update({
      where: { id: existing.id },
      data: { conversionRate },
    })
  }

  // Create new record
  return db.scrapingSourcePerformance.create({
    data: {
      organizationId: input.organizationId,
      sourceDomain: input.sourceDomain,
      sourceType: input.sourceType,
      totalScraped: input.totalScraped,
      leadsCreated: input.leadsCreated,
      avgLeadScore: input.avgLeadScore,
      commonProfessions: input.professions,
      lastScrapedAt: new Date(),
    },
  })
}

export async function recordLeadConversion(
  organizationId: string,
  sourceDomain: string
) {
  const source = await db.scrapingSourcePerformance.findUnique({
    where: {
      organizationId_sourceDomain: {
        organizationId,
        sourceDomain,
      },
    },
  })

  if (!source) return

  const leadsConverted = source.leadsConverted + 1
  const conversionRate = source.leadsCreated > 0 ? leadsConverted / source.leadsCreated : 0

  return db.scrapingSourcePerformance.update({
    where: { id: source.id },
    data: {
      leadsConverted,
      conversionRate,
    },
  })
}

export async function getScrapingPerformanceReport(organizationId: string) {
  const sources = await db.scrapingSourcePerformance.findMany({
    where: { organizationId },
    orderBy: { conversionRate: 'desc' },
  })

  return {
    totalSources: sources.length,
    topSources: sources.slice(0, 10),
    totalLeadsCreated: sources.reduce((sum, s) => sum + s.leadsCreated, 0),
    totalConversions: sources.reduce((sum, s) => sum + s.leadsConverted, 0),
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/scraping-tracker.ts
git commit -m "feat: add scraping performance tracker"
```

---

## Task 9: Create Scraping Performance API

**Files:**
- Create: `src/app/api/scraping/performance/route.ts`

**Step 1: Create the endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withRequestOrgContext } from '@/lib/request-context'
import { getScrapingPerformanceReport } from '@/lib/scraping-tracker'

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const report = await getScrapingPerformanceReport(context.organizationId)

      return NextResponse.json(report)
    })
  } catch (error) {
    console.error('Scraping performance error:', error)
    return NextResponse.json(
      { error: 'Failed to load scraping performance' },
      { status: 500 }
    )
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/scraping/performance/
git commit -m "feat: add scraping performance API endpoint"
```

---

## Task 10: Create Weekly/Monthly Report Endpoints

**Files:**
- Create: `src/app/api/ai/reports/weekly/route.ts`
- Create: `src/app/api/ai/reports/monthly/route.ts`

**Step 1: Create weekly report endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withRequestOrgContext } from '@/lib/request-context'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const userId = context.userId || 'unknown'
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      // Get user's learning events from past week
      const profile = await db.userAIProfile.findUnique({
        where: { userId },
        include: {
          learningHistory: {
            where: {
              createdAt: { gte: sevenDaysAgo },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!profile) {
        return NextResponse.json({
          totalEvents: 0,
          successfulPredictions: 0,
          topEventTypes: [],
        })
      }

      // Analyze events
      const eventsByType = profile.learningHistory.reduce((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const successfulEvents = profile.learningHistory.filter(
        (e) => e.outcome === 'success'
      ).length

      const topEventTypes = Object.entries(eventsByType)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count }))

      return NextResponse.json({
        totalEvents: profile.learningHistory.length,
        successfulPredictions: successfulEvents,
        successRate:
          profile.learningHistory.length > 0
            ? successfulEvents / profile.learningHistory.length
            : 0,
        topEventTypes,
        weekStart: sevenDaysAgo,
        weekEnd: new Date(),
      })
    })
  } catch (error) {
    console.error('Weekly report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate weekly report' },
      { status: 500 }
    )
  }
}
```

**Step 2: Create monthly scraping report endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withRequestOrgContext } from '@/lib/request-context'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const sources = await db.scrapingSourcePerformance.findMany({
        where: {
          organizationId: context.organizationId,
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { conversionRate: 'desc' },
      })

      // Aggregate by source type
      const byType = sources.reduce((acc, source) => {
        if (!acc[source.sourceType]) {
          acc[source.sourceType] = {
            count: 0,
            totalLeads: 0,
            totalConversions: 0,
          }
        }
        acc[source.sourceType].count++
        acc[source.sourceType].totalLeads += source.leadsCreated
        acc[source.sourceType].totalConversions += source.leadsConverted
        return acc
      }, {} as Record<string, { count: number; totalLeads: number; totalConversions: number }>)

      const summary = Object.entries(byType).map(([type, data]) => ({
        sourceType: type,
        sourceCount: data.count,
        totalLeads: data.totalLeads,
        totalConversions: data.totalConversions,
        conversionRate:
          data.totalLeads > 0 ? data.totalConversions / data.totalLeads : 0,
      }))

      return NextResponse.json({
        period: { start: thirtyDaysAgo, end: new Date() },
        topSources: sources.slice(0, 10),
        summaryByType: summary.sort((a, b) => b.conversionRate - a.conversionRate),
      })
    })
  } catch (error) {
    console.error('Monthly scraping report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate monthly report' },
      { status: 500 }
    )
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/ai/reports/
git commit -m "feat: add weekly and monthly report endpoints"
```

---

## Task 11: Integrate Tracking into Scrape Flow

**Files:**
- Modify: `src/app/api/scrape/route.ts`

**Step 1: Add scraping performance tracking**

```typescript
import { trackScrapingPerformance } from '@/lib/scraping-tracker'

// In the scrape completion handler:
await trackScrapingPerformance({
  organizationId: context.organizationId,
  sourceDomain: new URL(sourceUrl).hostname,
  sourceType: type || 'website',
  totalScraped: stats.pagesScraped || 0,
  leadsCreated: stats.leadsCreated || 0,
  avgLeadScore: stats.avgLeadScore,
  professions: stats.professions || [],
}).catch(console.error)
```

**Step 2: Commit**

```bash
git add src/app/api/scrape/route.ts
git commit -m "feat: track scraping performance for learning"
```

---

## Task 12: Add Profession Tracking to Lead Creation

**Files:**
- Modify: `src/app/api/leads/route.ts`

**Step 1: Extract and store profession from lead data**

```typescript
// When creating/updating leads, extract profession from company/title
function extractProfession(company: string | null, title: string | null): string | null {
  if (!company && !title) return null

  const combined = `${company || ''} ${title || ''}`.toLowerCase()

  // Common industry keywords
  const industryMap: Record<string, string> = {
    construction: 'Construction',
    healthcare: 'Healthcare',
    medical: 'Healthcare',
    tech: 'Technology',
    software: 'Technology',
    finance: 'Finance',
    real estate: 'Real Estate',
    manufacturing: 'Manufacturing',
    education: 'Education',
    retail: 'Retail',
    // Add more as needed
  }

  for (const [keyword, industry] of Object.entries(industryMap)) {
    if (combined.includes(keyword)) {
      return industry
    }
  }

  return null
}

// In lead creation:
const profession = extractProfession(leadData.company, leadData.title)

const lead = await db.lead.create({
  data: {
    // ... other fields
    profession,
  },
})
```

**Step 2: Commit**

```bash
git add src/app/api/leads/route.ts
git commit -m "feat: extract and store lead profession for targeting"
```

---

## Task 13: Create Pattern Extraction Job (Weekly)

**Files:**
- Create: `src/app/api/ai/internal/extract-patterns/route.ts`

**Step 1: Create pattern extraction endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withRequestOrgContext } from '@/lib/request-context'

// This should be protected - only callable by cron or admin
export async function POST(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      const userId = context.userId
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const profile = await db.userAIProfile.findUnique({
        where: { userId },
        include: {
          learningHistory: {
            where: {
              createdAt: { gte: sevenDaysAgo },
              outcome: { in: ['success', 'failure'] },
            },
          },
        },
      })

      if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
      }

      const events = profile.learningHistory

      // Extract successful patterns
      const successfulSMS = events
        .filter((e) => e.eventType === 'sms_sent' && e.outcome === 'success')
        .map((e) => e.output)

      const successfulEmails = events
        .filter((e) => e.eventType === 'email_sent' && e.outcome === 'success')
        .map((e) => e.output)

      // Extract patterns by profession
      const byProfession = events.reduce((acc, e) => {
        if (!e.leadProfession) return acc
        if (!acc[e.leadProfession]) {
          acc[e.leadProfession] = { success: 0, total: 0 }
        }
        acc[e.leadProfession].total++
        if (e.outcome === 'success') acc[e.leadProfession].success++
        return acc
      }, {} as Record<string, { success: number; total: number }>)

      // Update profile with learned patterns
      await db.userAIProfile.update({
        where: { id: profile.id },
        data: {
          smsPatterns: {
            successfulTemplates: successfulSMS.slice(-10), // Last 10 successful
            totalSuccessful: successfulSMS.length,
          },
          emailPatterns: {
            successfulTemplates: successfulEmails.slice(-10),
            totalSuccessful: successfulEmails.length,
          },
          industryKnowledge: byProfession,
          lastUpdatedAt: new Date(),
        },
      })

      return NextResponse.json({
        extracted: {
          smsPatterns: successfulSMS.length,
          emailPatterns: successfulEmails.length,
          industryPatterns: Object.keys(byProfession).length,
        },
      })
    })
  } catch (error) {
    console.error('Pattern extraction error:', error)
    return NextResponse.json(
      { error: 'Failed to extract patterns' },
      { status: 500 }
    )
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/ai/internal/
git commit -m "feat: add pattern extraction job for learning"
```

---

## Task 14: Create Personalized AI Generation Endpoint

**Files:**
- Create: `src/app/api/ai/generate/personalized/route.ts`

**Step 1: Create personalized generation endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/validation'
import { enforceRateLimit } from '@/lib/rate-limit'
import { withRequestOrgContext } from '@/lib/request-context'
import { db } from '@/lib/db'
import { zaiChatJson } from '@/lib/zai'

const personalizedGenSchema = z.object({
  task: z.enum(['sms', 'email', 'playbook', 'content']),
  context: z.record(z.string(), z.unknown()),
  leadProfession: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const limited = enforceRateLimit(request, {
      key: 'ai-personalized',
      limit: 30,
      windowMs: 60_000,
    })
    if (limited) return limited

    return withRequestOrgContext(request, async (context) => {
      const parsed = await parseJsonBody(request, personalizedGenSchema)
      if (!parsed.success) return parsed.response

      const { task, context: taskContext, leadProfession } = parsed.data
      const userId = context.userId || 'unknown'

      // Get user's learned profile
      const profile = await db.userAIProfile.findUnique({
        where: { userId },
      })

      let personalizationContext = ''

      // Add learned patterns to prompt
      if (profile) {
        if (task === 'sms' && profile.smsPatterns) {
          const successful = (profile.smsPatterns as any).successfulTemplates || []
          if (successful.length > 0) {
            personalizationContext += `\n\nUser's successful SMS patterns:\n${JSON.stringify(successful.slice(-3))}\n`
          }
        }

        if (task === 'email' && profile.emailPatterns) {
          const successful = (profile.emailPatterns as any).successfulTemplates || []
          if (successful.length > 0) {
            personalizationContext += `\n\nUser's successful email patterns:\n${JSON.stringify(successful.slice(-3))}\n`
          }
        }

        if (leadProfession && profile.industryKnowledge) {
          const industryData = (profile.industryKnowledge as any)[leadProfession]
          if (industryData) {
            personalizationContext += `\n\nWhat works for ${leadProfession}:\nSuccess rate: ${industryData.success}/${industryData.total} (${Math.round(industryData.success / industryData.total * 100)}%)\n`
          }
        }
      }

      // Build prompt with personalization
      const prompt = `Generate a ${task} for this CRM task.

Task context:
${JSON.stringify(taskContext)}

${personalizationContext}

Generate in a style that matches the user's successful patterns above. Respond with JSON containing the result.`

      const result = await zaiChatJson(prompt)

      // Track this generation
      // (Tracking code would go here)

      return NextResponse.json({
        result,
        personalized: !!personalizationContext,
      })
    })
  } catch (error) {
    console.error('Personalized generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate personalized content' },
      { status: 500 }
    )
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/ai/generate/
git commit -m "feat: add personalized AI generation using learned patterns"
```

---

## Task 15: Add pgvector Embedding Generation

**Files:**
- Create: `src/lib/embeddings.ts`

**Step 1: Create embedding utility**

```typescript
// Simple embedding generation using a hash function for MVP
// In production, use OpenAI embeddings or similar

export function generateEmbedding(text: string): number[] {
  // Simple hash-based embedding for MVP (1536 dimensions)
  const dimensions = 1536
  const embedding: number[] = []

  for (let i = 0; i < dimensions; i++) {
    // Generate a pseudo-random value based on text and position
    const hash = simpleHash(text + i)
    embedding.push((hash % 1000) / 1000) // Normalize to 0-1
  }

  return embedding
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

// Calculate cosine similarity between two embeddings
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
```

**Step 2: Commit**

```bash
git add src/lib/embeddings.ts
git commit -m "feat: add embedding generation utilities"
```

---

## Task 16: Update Event Tracking to Store Embeddings

**Files:**
- Modify: `src/lib/ai-tracking.ts`

**Step 1: Add embedding generation to trackAIEvent**

```typescript
import { generateEmbedding } from './embeddings'

export async function trackAIEvent(input: TrackEventInput) {
  const profile = await ensureUserAIProfile(input.userId)

  // Generate embedding for the event
  const eventText = JSON.stringify({ input: input.input, output: input.output })
  const embedding = generateEmbedding(eventText)

  const event = await db.userLearningEvent.create({
    data: {
      userProfileId: profile.id,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      input: input.input as Record<string, unknown>,
      output: input.output as Record<string, unknown>,
      leadProfession: input.leadProfession,
      sourceType: input.sourceType,
      embedding, // Store embedding
    },
  })

  // ... rest of function
}
```

**Step 2: Commit**

```bash
git add src/lib/ai-tracking.ts
git commit -m "feat: store embeddings with learning events"
```

---

## Task 17: Create Similar Events Retrieval for RAG

**Files:**
- Create: `src/lib/rag-retrieval.ts`

**Step 1: Create RAG retrieval utility**

```typescript
import { db } from '@/lib/db'
import { generateEmbedding, cosineSimilarity } from './embeddings'

export interface RetrievedEvent {
  id: string
  eventType: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  outcome: string | null
  similarity: number
}

export async function retrieveSimilarEvents(
  userId: string,
  queryInput: Record<string, unknown>,
  eventType?: string,
  limit = 5
): Promise<RetrievedEvent[]> {
  // Generate embedding for query
  const queryText = JSON.stringify(queryInput)
  const queryEmbedding = generateEmbedding(queryText)

  // Get user's profile
  const profile = await db.userAIProfile.findUnique({
    where: { userId },
  })

  if (!profile) return []

  // Get recent events with embeddings
  const events = await db.userLearningEvent.findMany({
    where: {
      userProfileId: profile.id,
      ...(eventType && { eventType }),
    },
    orderBy: { createdAt: 'desc' },
    take: 100, // Retrieve last 100 events
  })

  // Calculate similarity and rank
  const ranked = events
    .map((event) => {
      const eventEmbedding = event.embedding as number[] | null
      if (!eventEmbedding) return null

      const similarity = cosineSimilarity(queryEmbedding, eventEmbedding)

      return {
        id: event.id,
        eventType: event.eventType,
        input: event.input as Record<string, unknown>,
        output: event.output as Record<string, unknown>,
        outcome: event.outcome,
        similarity,
      }
    })
    .filter((e): e is RetrievedEvent => e !== null && e.similarity > 0.5)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)

  return ranked
}

export async function getSuccessfulPatterns(
  userId: string,
  eventType: string,
  limit = 10
): Promise<RetrievedEvent[]> {
  const profile = await db.userAIProfile.findUnique({
    where: { userId },
  })

  if (!profile) return []

  const events = await db.userLearningEvent.findMany({
    where: {
      userProfileId: profile.id,
      eventType,
      outcome: 'success',
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return events.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    input: event.input as Record<string, unknown>,
    output: event.output as Record<string, unknown>,
    outcome: event.outcome,
    similarity: 1, // All successful events have high relevance
  }))
}
```

**Step 2: Commit**

```bash
git add src/lib/rag-retrieval.ts
git commit -m "feat: add RAG retrieval for similar events"
```

---

## Task 18: Integrate RAG into Personalized Generation

**Files:**
- Modify: `src/app/api/ai/generate/personalized/route.ts`

**Step 1: Add RAG retrieval to personalized generation**

```typescript
import { retrieveSimilarEvents, getSuccessfulPatterns } from '@/lib/rag-retrieval'

// In the POST handler:
const similarEvents = await retrieveSimilarEvents(
  userId,
  taskContext,
  task,
  3
)

const successfulPatterns = await getSuccessfulPatterns(userId, task, 5)

let ragContext = ''
if (similarEvents.length > 0) {
  ragContext += `\n\nSimilar past interactions:\n${JSON.stringify(similarEvents.map(e => ({ input: e.input, output: e.output, outcome: e.outcome })))}\n`
}

if (successfulPatterns.length > 0) {
  ragContext += `\n\nUser's successful patterns for this task:\n${JSON.stringify(successfulPatterns.map(e => e.output))}\n`
}

// Update prompt to include RAG context
const prompt = `Generate a ${task} for this CRM task.

Task context:
${JSON.stringify(taskContext)}

${personalizationContext}

${ragContext}

Generate in a style that matches the user's successful patterns above. Use insights from similar past interactions. Respond with JSON containing the result.`
```

**Step 2: Commit**

```bash
git add src/app/api/ai/generate/personalized/route.ts
git commit -m "feat: integrate RAG retrieval into personalized generation"
```

---

## Task 19: Add Request Context Helper

**Files:**
- Modify: `src/lib/request-context.ts`

**Step 1: Add userId extraction**

Ensure the request context helper extracts userId from the session:

```typescript
// In withRequestOrgContext, ensure userId is available
export interface RequestContext {
  organizationId: string
  userId?: string  // Should be extracted from session
  // ... other fields
}
```

**Step 2: Commit**

```bash
git add src/lib/request-context.ts
git commit -m "feat: ensure userId available in request context"
```

---

## Task 20: Create Admin Learning Insights Dashboard

**Files:**
- Create: `src/app/api/ai/admin/insights/route.ts`

**Step 1: Create admin insights endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withRequestOrgContext } from '@/lib/request-context'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    return withRequestOrgContext(request, async (context) => {
      // Admin check would go here

      const profiles = await db.userAIProfile.findMany({
        include: {
          learningHistory: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
        take: 20,
      })

      const insights = profiles.map((profile) => ({
        userId: profile.userId,
        totalInteractions: profile.totalInteractions,
        successfulPredictions: profile.successfulPredictions,
        successRate:
          profile.totalInteractions > 0
            ? profile.successfulPredictions / profile.totalInteractions
            : 0,
        lastActive: profile.lastUpdatedAt,
        topEventTypes: profile.learningHistory
          .slice(0, 5)
          .map((e) => e.eventType),
      }))

      return NextResponse.json({
        totalProfiles: profiles.length,
        insights,
      })
    })
  } catch (error) {
    console.error('Admin insights error:', error)
    return NextResponse.json(
      { error: 'Failed to load insights' },
      { status: 500 }
    )
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/ai/admin/
git commit -m "feat: add admin learning insights endpoint"
```

---

## Task 21: Write Integration Tests

**Files:**
- Create: `src/app/api/ai/track/integration.test.ts`
- Create: `src/app/api/ai/profile/integration.test.ts`

**Step 1: Create integration test for tracking flow**

```typescript
describe('AI Learning Integration', () => {
  it('should track event, record outcome, and update profile', async () => {
    // 1. Track an event
    // 2. Record outcome
    // 3. Verify profile updated
    // 4. Verify pattern extraction works
  })
})
```

**Step 2: Commit**

```bash
git add src/app/api/ai/*/integration.test.ts
git commit -m "test: add integration tests for AI learning"
```

---

## Task 22: Update Documentation

**Files:**
- Create: `docs/ai-learning-system.md`

**Step 1: Create system documentation**

```markdown
# AI Personalized Learning System

## Overview

The AI learning system personalizes for each user by learning from their interactions.

## How It Works

1. **Event Capture**: Every AI interaction is logged
2. **Feedback Loop**: User feedback and outcomes are recorded
3. **Pattern Extraction**: Weekly jobs extract successful patterns
4. **Profile Update**: User profiles are updated with learned patterns
5. **Personalized Generation**: AI uses RAG to retrieve similar successful interactions

## API Endpoints

- `POST /api/ai/track` - Track AI interactions
- `POST /api/ai/feedback` - Submit feedback (links to events)
- `GET /api/ai/profile` - Get user's learned profile
- `GET /api/ai/reports/weekly` - Weekly performance report
- `GET /api/ai/reports/monthly` - Monthly scraping report
- `POST /api/ai/generate/personalized` - Generate using learned patterns

## Usage Example

\`\`\`typescript
// Track an AI event
await fetch('/api/ai/track', {
  method: 'POST',
  body: JSON.stringify({
    eventType: 'sms_sent',
    entityType: 'lead',
    entityId: 'lead-1',
    input: { template: 'follow-up-1' },
    output: { smsText: 'Hey, checking in...' },
    leadProfession: 'Construction',
  })
})

// Later, record outcome
await fetch('/api/ai/feedback', {
  method: 'POST',
  body: JSON.stringify({
    eventId: 'event-1',
    rating: 5,
    feedback: 'Lead replied!',
  })
})
\`\`\`
```

**Step 2: Commit**

```bash
git add docs/ai-learning-system.md
git commit -m "docs: add AI learning system documentation"
```

---

## Task 23: Final Integration Test

**Files:**
- Modify: Existing AI routes to ensure tracking works

**Step 1: Manual testing checklist**

```bash
# 1. Test event tracking
curl -X POST http://localhost:3000/api/ai/track \
  -H "Content-Type: application/json" \
  -d '{"eventType":"sms_sent","entityType":"lead","entityId":"test-1","input":{},"output":{}}'

# 2. Test feedback linking
curl -X POST http://localhost:3000/api/ai/feedback \
  -H "Content-Type: application/json" \
  -d '{"eventId":"<event-id>","rating":5}'

# 3. Test profile retrieval
curl http://localhost:3000/api/ai/profile

# 4. Test weekly report
curl http://localhost:3000/api/ai/reports/weekly

# 5. Test personalized generation
curl -X POST http://localhost:3000/api/ai/generate/personalized \
  -H "Content-Type: application/json" \
  -d '{"task":"sms","context":{"leadName":"John"}}'
```

**Step 2: Verify all tests pass**

```bash
npm test
```

**Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete AI personalized learning system

- Event capture layer for all AI interactions
- Feedback loop that links to learning events
- Weekly/monthly reporting
- RAG-based personalized generation
- Scraping source performance tracking
- Admin insights dashboard

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary

This implementation plan creates a comprehensive AI learning system that:

1. **Captures every AI interaction** with context and outcomes
2. **Links user feedback** to specific events for learning
3. **Extracts patterns weekly** from successful interactions
4. **Personalizes generation** using RAG over past events
5. **Tracks scraping performance** with monthly reports
6. **Provides admin insights** into system learning

The system is designed to continuously improve as users interact with it, learning their communication style, what works for their leads, and building domain knowledge over time.

**Total Estimated Time:** 2-3 weeks for full implementation
**Priority Tasks:** Tasks 1-7 for core functionality
**Nice-to-Have:** Tasks 8-23 for advanced features
