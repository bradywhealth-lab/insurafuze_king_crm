import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { enforceRateLimit } from '@/lib/rate-limit'
import { parseJsonBody } from '@/lib/validation'
import { enforceSameOrigin } from '@/lib/security'

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(200),
})

export async function POST(request: NextRequest) {
  try {
    const csrfBlocked = enforceSameOrigin(request)
    if (csrfBlocked) return csrfBlocked

    const limited = enforceRateLimit(request, {
      key: 'reset-password',
      limit: 10,
      windowMs: 15 * 60_000,
    })
    if (limited) return limited

    const parsed = await parseJsonBody(request, schema)
    if (!parsed.success) return parsed.response

    const { token, password } = parsed.data

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
      include: { user: { select: { id: true } } },
    })

    if (!resetToken) {
      return NextResponse.json({ error: 'Invalid or expired reset token.' }, { status: 400 })
    }

    if (resetToken.usedAt) {
      return NextResponse.json({ error: 'This reset token has already been used.' }, { status: 400 })
    }

    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: 'This reset token has expired. Please request a new one.' }, { status: 400 })
    }

    const passwordHash = hashPassword(password)

    await db.$transaction(async (tx) => {
      // Update password
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      })

      // Mark token as used
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      })

      // Invalidate all active sessions
      await tx.userSession.updateMany({
        where: { userId: resetToken.userId, isActive: true },
        data: { isActive: false },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
