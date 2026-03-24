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
    const user = await db.user.findUnique({
      where: { email },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, plan: true },
        },
      },
    })
    if (!user) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 })
    }

    const preferences = readUserPreferences(user.preferences)
    const inviteTokenHash = typeof preferences.inviteTokenHash === 'string' ? preferences.inviteTokenHash : null
    const inviteTokenExpiresAt = typeof preferences.inviteTokenExpiresAt === 'string' ? preferences.inviteTokenExpiresAt : null
    if (
      !inviteTokenHash ||
      inviteTokenHash !== hashSessionToken(parsed.data.token) ||
      !inviteTokenExpiresAt ||
      Number.isNaN(Date.parse(inviteTokenExpiresAt)) ||
      new Date(inviteTokenExpiresAt) <= new Date()
    ) {
      return NextResponse.json({ error: 'Invitation is invalid or expired.' }, { status: 401 })
    }

    delete preferences.inviteTokenHash
    delete preferences.inviteTokenExpiresAt
    delete preferences.requirePasswordChange
    preferences.invitedAcceptedAt = new Date().toISOString()

    const updated = await db.$transaction(async (tx) => {
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

    return NextResponse.json({
      success: true,
      user: serializeAuthUser(updated),
      mustChangePassword: false,
    })
  } catch (error) {
    console.error('Accept invite POST error:', error)
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 })
  }
}
