import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/lib/db'
import { enforceRateLimit } from '@/lib/rate-limit'
import { parseJsonBody } from '@/lib/validation'
import { enforceSameOrigin } from '@/lib/security'

const schema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const csrfBlocked = enforceSameOrigin(request)
    if (csrfBlocked) return csrfBlocked

    const parsed = await parseJsonBody(request, schema)
    if (!parsed.success) return parsed.response

    const email = parsed.data.email.trim().toLowerCase()

    const limited = enforceRateLimit(request, {
      key: `forgot-password:${email}`,
      limit: 3,
      windowMs: 15 * 60_000,
    })
    if (limited) return limited

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true, token: null })
    }

    // Expire any existing unused tokens for this user
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    })

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    })

    return NextResponse.json({ success: true, token })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
