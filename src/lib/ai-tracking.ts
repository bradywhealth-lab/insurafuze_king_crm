import { db } from '@/lib/db'
import { generateEmbedding } from '@/lib/embeddings'
import { PineconeClient } from '@/lib/pinecone-client'

export type LearningEventType =
  | 'sms_sent'
  | 'email_sent'
  | 'lead_scored'
  | 'playbook_generated'
  | 'content_generated'
  | 'insights_generated'
  | 'chat_message'

// TrackEventInput is deprecated - use individual parameters instead
// @deprecated Use individual parameters in trackAIEvent instead
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
  syncToPinecone?: boolean
}

export interface RecordOutcomeInput {
  eventId: string
  outcome: 'success' | 'failure' | 'pending'
  outcomeDelay?: number // minutes
  userRating?: number // 1-5
  userCorrection?: Record<string, unknown>
}

/**
 * Ensures a UserAIProfile exists for the given user.
 * Creates one if it doesn't exist, otherwise returns the existing profile.
 */
export async function ensureUserAIProfile(userId: string) {
  const existing = await db.userAIProfile.findUnique({
    where: { userId },
  })

  if (existing) return existing

  return db.userAIProfile.create({
    data: { userId },
  })
}

/**
 * Tracks an AI interaction event for learning.
 *
 * Enhanced with Pinecone sync for vector search capabilities.
 *
 * @param userId - User ID who triggered the event
 * @param eventType - Type of event (sms_sent, email_sent, etc.)
 * @param entityType - Type of entity (lead, contact, etc.)
 * @param entityId - ID of the entity
 * @param input - Input data for the AI interaction
 * @param output - Output data from the AI interaction
 * @param options - Optional parameters (leadProfession, sourceType, syncToPinecone)
 * @returns Event ID and optional Pinecone ID
 */
export async function trackAIEvent(
  userId: string,
  eventType: string,
  entityType: string,
  entityId: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  options?: {
    leadProfession?: string
    sourceType?: string
    syncToPinecone?: boolean
  }
): Promise<{
  eventId: string
  pineconeId?: string
}> {
  // Get or create user profile
  const profile = await ensureUserAIProfile(userId)

  // Generate embedding from input only
  const embedding = await generateEmbedding(JSON.stringify(input))

  // Create event in database
  const event = await db.userLearningEvent.create({
    data: {
      userProfileId: profile.id,
      eventType,
      entityType,
      entityId,
      input,
      output,
      embedding, // Store in PostgreSQL as backup
      leadProfession: options?.leadProfession,
      sourceType: options?.sourceType
    }
  })

  // Sync to Pinecone if enabled (default: true)
  const shouldSync = options?.syncToPinecone !== false

  let pineconeId: string | undefined

  if (shouldSync && PineconeClient.isAvailable()) {
    try {
      // Get user's organization
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { organizationId: true }
      })

      if (user) {
        const pineconeEventId = `${user.organizationId}_${event.id}`

        await PineconeClient.upsertEvent(
          pineconeEventId,
          embedding,
          {
            userId,
            organizationId: user.organizationId,
            eventType,
            entityType,
            entityId,
            outcome: null, // Will be updated when feedback is received
            createdAt: event.createdAt.toISOString()
          }
        )

        // Update event with Pinecone ID
        await db.userLearningEvent.update({
          where: { id: event.id },
          data: { pineconeId: pineconeEventId }
        })

        pineconeId = pineconeEventId
      }
    } catch (error) {
      console.error('[AI Learning] Failed to sync to Pinecone:', error)
      // Continue even if sync fails
    }
  }

  // Update profile stats
  await db.userAIProfile.update({
    where: { id: profile.id },
    data: {
      totalInteractions: { increment: 1 },
      lastUpdatedAt: new Date()
    }
  })

  return {
    eventId: event.id,
    pineconeId
  }
}

/**
 * Records the outcome of a previously tracked AI event.
 * Updates the event with outcome information and increments
 * the successful predictions counter if the outcome was successful.
 */
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

/**
 * Retrieves a user's AI profile with their learning history.
 * Returns null if the profile doesn't exist.
 */
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
