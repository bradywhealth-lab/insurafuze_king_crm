import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  integration: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
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

import { GET, PUT } from './route'

describe('/api/integrations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists integrations for the current organization', async () => {
    mockDb.integration.findMany.mockResolvedValueOnce([
      {
        id: 'integration_1',
        type: 'calendar',
        name: 'Google Calendar',
        isActive: true,
        syncStatus: 'configured',
        syncError: null,
        config: { calendarId: 'primary' },
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/integrations'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.integrations).toHaveLength(1)
    expect(json.integrations[0].type).toBe('calendar')
  })

  it('upserts an integration config payload', async () => {
    mockDb.integration.findUnique.mockResolvedValueOnce(null)
    mockDb.integration.upsert.mockResolvedValueOnce({
      id: 'integration_1',
      type: 'calendar',
      name: 'Google Calendar',
      isActive: true,
      syncStatus: 'configured',
      syncError: null,
      config: { calendarId: 'primary' },
    })

    const request = new NextRequest('http://localhost/api/integrations', {
      method: 'PUT',
      body: JSON.stringify({
        type: 'calendar',
        name: 'Google Calendar',
        isActive: true,
        config: { calendarId: 'primary' },
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PUT(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.integration.type).toBe('calendar')
    expect(mockDb.integration.upsert).toHaveBeenCalledOnce()
  })
})
