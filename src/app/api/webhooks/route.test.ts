import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  webhook: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
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

import { DELETE, GET, POST } from './route'

describe('/api/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists webhooks for the active organization', async () => {
    mockDb.webhook.findMany.mockResolvedValueOnce([
      {
        id: 'webhook_1',
        name: 'Zapier',
        url: 'https://hooks.zapier.com/example',
        events: ['lead.created'],
        isActive: true,
      },
    ])

    const response = await GET(new NextRequest('http://localhost/api/webhooks'))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.webhooks).toHaveLength(1)
    expect(json.webhooks[0].name).toBe('Zapier')
  })

  it('creates a webhook from the dialog payload', async () => {
    mockDb.webhook.create.mockResolvedValueOnce({
      id: 'webhook_1',
      name: 'Zapier',
      url: 'https://hooks.zapier.com/example',
      events: ['lead.created', 'lead.updated'],
      isActive: true,
    })

    const request = new NextRequest('http://localhost/api/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Zapier',
        url: 'https://hooks.zapier.com/example',
        events: ['lead.created', 'lead.updated'],
        secret: 'secret_123',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.webhook.url).toBe('https://hooks.zapier.com/example')
    expect(mockDb.webhook.create).toHaveBeenCalledOnce()
  })

  it('deletes a webhook by id', async () => {
    mockDb.webhook.deleteMany.mockResolvedValueOnce({ count: 1 })

    const request = new NextRequest('http://localhost/api/webhooks?id=webhook_1', {
      method: 'DELETE',
    })

    const response = await DELETE(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockDb.webhook.deleteMany).toHaveBeenCalledWith({
      where: { id: 'webhook_1', organizationId: 'org_1' },
    })
  })
})
