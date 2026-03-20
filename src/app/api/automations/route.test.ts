import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  automation: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
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

import { GET, PATCH, POST } from './route'

describe('/api/automations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists automations for the active organization', async () => {
    mockDb.automation.findMany.mockResolvedValueOnce([
      {
        id: 'automation_1',
        name: 'New lead follow-up',
        description: 'Create an immediate task',
        trigger: 'lead_created',
        triggerConfig: {},
        conditions: {},
        actions: [{ type: 'create_task', target: 'Call in 5 minutes' }],
        isActive: true,
        executionCount: 4,
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/automations'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.automations).toHaveLength(1)
    expect(json.automations[0].name).toBe('New lead follow-up')
  })

  it('creates a new automation', async () => {
    mockDb.automation.create.mockResolvedValueOnce({
      id: 'automation_1',
      name: 'New lead follow-up',
      trigger: 'lead_created',
      actions: [{ type: 'create_task', target: 'Call in 5 minutes' }],
      isActive: true,
    })

    const request = new NextRequest('http://localhost/api/automations', {
      method: 'POST',
      body: JSON.stringify({
        name: 'New lead follow-up',
        trigger: 'lead_created',
        actions: [{ type: 'create_task', target: 'Call in 5 minutes' }],
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.automation.name).toBe('New lead follow-up')
    expect(mockDb.automation.create).toHaveBeenCalledOnce()
  })

  it('updates automation active state', async () => {
    mockDb.automation.updateMany.mockResolvedValueOnce({ count: 1 })
    mockDb.automation.findUnique.mockResolvedValueOnce({
      id: 'automation_1',
      isActive: false,
    })

    const request = new NextRequest('http://localhost/api/automations?id=automation_1', {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.automation.isActive).toBe(false)
  })
})
