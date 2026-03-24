import type { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  getCurrentSessionFromToken,
  hashPassword,
  readUserPreferences,
  verifyPassword,
} from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'
import { enforceSameOrigin } from '@/lib/security'
import { parseJsonBody } from '@/lib/validation'
import { z } from 'zod'

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
})

export async function POST(request: NextRequest) {
  try {
    const csrfBlocked = enforceSameOrigin(request)
    if (csrfBlocked) return csrfBlocked

    const limited = enforceRateLimit(request, {
      key: 'auth-change-password',
      limit: 10,
      windowMs: 15 * 60_000,
    })
    if (limited) return limited

    const parsed = await parseJsonBody(request, passwordSchema)
    if (!parsed.success) return parsed.response

    const sessionToken = request.cookies.get('session-token')?.value?.trim()
    if (!sessionToken) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    }

    const current = await getCurrentSessionFromToken(sessionToken)
    const session = current
      ? await db.userSession.findFirst({
          where: { id: current.sessionId },
          include: { user: true },
        })
      : null

    if (!session?.user || !verifyPassword(parsed.data.currentPassword, session.user.passwordHash)) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 })
    }

    const preferences = readUserPreferences(session.user.preferences)
    delete preferences.requirePasswordChange

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          passwordHash: hashPassword(parsed.data.newPassword),
          preferences: preferences as Prisma.InputJsonValue,
        },
      })

      await tx.userSession.updateMany({
        where: { userId: session.user.id, isActive: true },
        data: { isActive: false },
      })

      await tx.auditLog.create({
        data: {
          organizationId: session.user.organizationId,
          action: 'update',
          entityType: 'user',
          entityId: session.user.id,
          actorId: session.user.id,
          actorEmail: session.user.email,
          description: 'Updated account password and rotated active sessions',
        },
      })
    })

    return NextResponse.json({ success: true, mustChangePassword: false })
  } catch (error) {
    console.error('Password POST error:', error)
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }
}
