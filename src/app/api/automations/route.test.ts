import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockWithRequestOrgContext, mockIsInternalRunnerAuthorized } = vi.hoisted(() => ({
  mockDb: {
    automation: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    automationLog: {
      create: vi.fn(),
    },
  },
  mockWithRequestOrgContext: vi.fn(),
  mockIsInternalRunnerAuthorized: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/request-context', () => ({ withRequestOrgContext: mockWithRequestOrgContext }))
vi.mock('@/lib/internal-runner', () => ({ isInternalRunnerAuthorized: mockIsInternalRunnerAuthorized }))

describe('/api/automations routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWithRequestOrgContext.mockImplementation(async (_req, handler) =>
      handler({ organizationId: 'org-1', userId: 'user-1' })
    )
  })

  it('rejects invalid create payload via zod validation', async () => {
    const { POST } = await import('./route')
    const request = new NextRequest('http://localhost/api/automations', {
      method: 'POST',
      body: JSON.stringify({ name: 'Invalid Automation' }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid request body')
    expect(mockDb.automation.create).not.toHaveBeenCalled()
  })

  it('scopes list results to request organization', async () => {
    const { GET } = await import('./route')
    mockDb.automation.findMany.mockResolvedValueOnce([])

    const response = await GET(new NextRequest('http://localhost/api/automations'))

    expect(response.status).toBe(200)
    expect(mockDb.automation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } })
    )
  })

  it('blocks patch across org boundaries', async () => {
    const { PATCH } = await import('./route')
    mockDb.automation.findFirst.mockResolvedValueOnce(null)

    const request = new NextRequest('http://localhost/api/automations', {
      method: 'PATCH',
      body: JSON.stringify({ id: 'automation-2', isActive: false }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await PATCH(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Automation not found')
    expect(mockDb.automation.update).not.toHaveBeenCalled()
  })
})

describe('/api/automations/run route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWithRequestOrgContext.mockImplementation(async (_req, handler) =>
      handler({ organizationId: 'org-1', userId: null })
    )
    mockIsInternalRunnerAuthorized.mockReturnValue(true)
  })

  it('writes execution logs for successful and failed automation runs', async () => {
    const { POST } = await import('./run/route')
    mockDb.automation.findMany.mockResolvedValueOnce([
      {
        id: 'automation-success',
        conditions: { score: { gte: 70 } },
        actions: [{ type: 'send_email' }],
      },
      {
        id: 'automation-fail',
        conditions: {},
        actions: [{ type: 'task_create' }],
      },
    ])
    mockDb.automation.update.mockResolvedValueOnce({ id: 'automation-success' }).mockRejectedValueOnce(new Error('boom'))
    mockDb.automationLog.create.mockResolvedValue({ id: 'log-1' })

    const request = new NextRequest('http://localhost/api/automations/run', {
      method: 'POST',
      body: JSON.stringify({ trigger: 'lead_created', input: { score: 90 }, triggeredBy: 'runner' }),
      headers: { 'content-type': 'application/json', 'x-internal-runner-key': 'abc' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.processed).toBe(2)
    expect(data.succeeded).toBe(1)
    expect(data.failed).toBe(1)
    expect(mockDb.automationLog.create).toHaveBeenCalledTimes(2)
    expect(mockDb.automationLog.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ automationId: 'automation-success', success: true, error: null }),
      })
    )
    expect(mockDb.automationLog.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ automationId: 'automation-fail', success: false, error: 'boom' }),
      })
    )
  })
})
