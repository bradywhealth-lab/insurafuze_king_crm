import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, hashSessionToken, readUserPreferences, serializeAuthUser } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'
import { enforceSameOrigin } from '@/lib/security'
import { parseJsonBody } from '@/lib/validation'
import { z } from 'zod'

const acceptInviteSchema = z.object({
  email: z.string().email(),
  token: z.string().min(16).max(200),
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(8).max(200),
})

export async function POST(request: NextRequest) {
  try {
    const csrfBlocked = enforceSameOrigin(request)
    if (csrfBlocked) return csrfBlocked

    const parsed = await parseJsonBody(request, acceptInviteSchema)
    if (!parsed.success) return parsed.response

    const limited = enforceRateLimit(request, {
      key: `auth-accept-invite:${parsed.data.email.trim().toLowerCase()}`,
      limit: 10,
      windowMs: 15 * 60_000,
    })
    if (limited) return limited

    const email = parsed.data.email.trim().toLowerCase()
    const expectedTokenHash = hashSessionToken(parsed.data.token)

    // Generic error for both missing user and invalid/expired token to prevent enumeration
    const invalidResponse = NextResponse.json({ error: 'Invitation is invalid or expired.' }, { status: 401 })

    // Atomically validate and consume the invite token inside a transaction to prevent
    // concurrent accepts from both succeeding (race condition on token + password overwrite).
    let updated: Awaited<ReturnType<typeof db.user.update>> | null = null
    try {
      updated = await db.$transaction(async (tx) => {
        // Re-fetch inside transaction so the read and write are atomic
        const user = await tx.user.findUnique({
          where: { email },
          include: {
            organization: {
              select: { id: true, name: true, slug: true, plan: true },
            },
          },
        })
        if (!user) throw new Error('INVALID_INVITE')

        const preferences = readUserPreferences(user.preferences)
        const inviteTokenHash = typeof preferences.inviteTokenHash === 'string' ? preferences.inviteTokenHash : null
        const inviteTokenExpiresAt = typeof preferences.inviteTokenExpiresAt === 'string' ? preferences.inviteTokenExpiresAt : null
        if (
          !inviteTokenHash ||
          inviteTokenHash !== expectedTokenHash ||
          !inviteTokenExpiresAt ||
          Number.isNaN(Date.parse(inviteTokenExpiresAt)) ||
          new Date(inviteTokenExpiresAt) <= new Date()
        ) {
          throw new Error('INVALID_INVITE')
        }

        delete preferences.inviteTokenHash
        delete preferences.inviteTokenExpiresAt
        delete preferences.requirePasswordChange
        preferences.invitedAcceptedAt = new Date().toISOString()

        const nextUser = await tx.user.update({
          where: { id: user.id },
          data: {
            name: parsed.data.name?.trim() || user.name,
            passwordHash: hashPassword(parsed.data.password),
            preferences: preferences as Prisma.InputJsonValue,
          },
          include: {
            organization: {
              select: { id: true, name: true, slug: true, plan: true },
            },
          },
        })

        await tx.userSession.updateMany({
          where: { userId: user.id, isActive: true },
          data: { isActive: false },
        })

        await tx.auditLog.create({
          data: {
            organizationId: user.organizationId,
            action: 'accept_invite',
            entityType: 'user',
            entityId: user.id,
            actorId: user.id,
            actorEmail: user.email,
            description: 'Accepted workspace invitation and activated account',
          },
        })

        return nextUser
      })
    } catch (err) {
      if (err instanceof Error && err.message === 'INVALID_INVITE') {
        return invalidResponse
      }
      throw err
    }

    return NextResponse.json({
      success: true,
      user: serializeAuthUser(updated!),
      mustChangePassword: false,
    })
  } catch (error) {
    console.error('Accept invite POST error:', error)
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 })
  }
}
