import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  userSession: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/request-context', () => ({
  withRequestOrgContext: vi.fn(async (_request: NextRequest, handler: (context: { organizationId: string; userId: string }) => Promise<unknown>) =>
    handler({ organizationId: 'org_1', userId: 'user_1' }),
  ),
}))

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: vi.fn(() => null),
}))

import { DELETE, GET } from './route'

describe('/api/security/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists active sessions and marks the current session', async () => {
    mockDb.userSession.findMany.mockResolvedValueOnce([
      {
        id: 'session_1',
        createdAt: new Date('2026-03-19T00:00:00.000Z'),
        expiresAt: new Date('2026-04-19T00:00:00.000Z'),
        lastActiveAt: new Date('2026-03-19T12:00:00.000Z'),
        device: 'MacBook Pro',
        browser: 'Chrome',
        os: 'macOS',
        city: 'Miami',
        country: 'US',
        token: 'b141f7cb72ca456697f987b6ef86a36acd731b9ea91a1f7a6c74ccb72b291a10',
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/security/sessions', {
      headers: { cookie: 'session-token=session_token' },
    }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.sessions).toHaveLength(1)
    expect(json.sessions[0].isCurrent).toBe(true)
  })

  it('revokes a user session', async () => {
    mockDb.userSession.findFirst.mockResolvedValueOnce({
      id: 'session_2',
      userId: 'user_1',
    })
    mockDb.userSession.update.mockResolvedValueOnce({ id: 'session_2' })
    mockDb.auditLog.create.mockResolvedValueOnce({ id: 'audit_1' })

    const response = await DELETE(new NextRequest('http://localhost/api/security/sessions?id=session_2', {
      method: 'DELETE',
    }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockDb.userSession.update).toHaveBeenCalledWith({
      where: { id: 'session_2' },
      data: { isActive: false },
    })
    expect(mockDb.auditLog.create).toHaveBeenCalledOnce()
  })
})
