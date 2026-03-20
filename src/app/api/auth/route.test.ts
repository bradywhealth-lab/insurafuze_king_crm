import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockDb = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  userSession: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}))

const mockAuth = vi.hoisted(() => ({
  AUTH_COOKIE_NAME: 'session-token',
  SESSION_TTL_MS: 1000 * 60 * 60,
  buildSessionCookieOptions: vi.fn((expiresAt: Date) => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    expires: expiresAt,
    priority: 'high',
  })),
  createSessionToken: vi.fn(() => 'session_token'),
  ensureUniqueOrganizationSlug: vi.fn(async () => 'acme-insurance'),
  getCurrentSessionFromToken: vi.fn(),
  getCurrentUserFromCookies: vi.fn(),
  hashPassword: vi.fn(() => 'hashed-password'),
  hashSessionToken: vi.fn(() => 'hashed_session_token'),
  invalidateSessionToken: vi.fn(),
  readSessionClientDetails: vi.fn(() => ({
    device: 'macOS device',
    browser: 'Chrome',
    os: 'macOS',
    ip: '127.0.0.1',
  })),
  slugifyOrganizationName: vi.fn(() => 'acme-insurance'),
  verifyPassword: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: mockDb,
}))

vi.mock('@/lib/auth', () => mockAuth)

import { DELETE, GET, POST } from './route'

describe('/api/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.createSessionToken.mockReturnValue('session_token')
    mockAuth.ensureUniqueOrganizationSlug.mockResolvedValue('acme-insurance')
    mockAuth.getCurrentSessionFromToken.mockReset()
    mockAuth.hashPassword.mockReturnValue('hashed-password')
    mockAuth.hashSessionToken.mockReturnValue('hashed_session_token')
  })

  it('returns the active session user', async () => {
    mockAuth.getCurrentUserFromCookies.mockResolvedValueOnce({
      sessionId: 'session_1',
      expiresAt: new Date('2026-03-20T00:00:00.000Z'),
      user: {
        id: 'user_1',
        email: 'owner@example.com',
        name: 'Owner',
        role: 'owner',
        organizationId: 'org_1',
        organization: { id: 'org_1', name: 'Acme', slug: 'acme', plan: 'pro' },
      },
    })

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.authenticated).toBe(true)
    expect(json.user.email).toBe('owner@example.com')
  })

  it('creates an organization, user, and session on signup', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce(null)
    mockDb.$transaction.mockImplementationOnce(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
      callback({
        organization: {
          create: vi.fn(async () => ({
            id: 'org_1',
            name: 'Acme Insurance',
            slug: 'acme-insurance',
            plan: 'pro',
          })),
        },
        user: {
          create: vi.fn(async () => ({
            id: 'user_1',
            email: 'owner@example.com',
            name: 'Owner',
            role: 'owner',
            organizationId: 'org_1',
            organization: {
              id: 'org_1',
              name: 'Acme Insurance',
              slug: 'acme-insurance',
              plan: 'pro',
            },
          })),
        },
        teamMember: {
          create: vi.fn(async () => ({ id: 'team_1' })),
        },
        userSession: {
          create: vi.fn(async () => ({ id: 'session_1' })),
          updateMany: vi.fn(async () => ({ count: 0 })),
        },
        auditLog: {
          create: vi.fn(async () => ({ id: 'audit_1' })),
        },
      }),
    )

    const request = new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      body: JSON.stringify({
        action: 'signup',
        name: 'Owner',
        email: 'owner@example.com',
        password: 'supersecure123',
        organizationName: 'Acme Insurance',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.authenticated).toBe(true)
    expect(json.user.organization.slug).toBe('acme-insurance')
    expect(mockDb.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'owner@example.com' },
      select: { id: true },
    })
    expect(mockAuth.hashSessionToken).toHaveBeenCalledWith('session_token')
  })

  it('creates a session on successful login', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({
      id: 'user_1',
      email: 'owner@example.com',
      passwordHash: 'stored-hash',
      preferences: null,
      name: 'Owner',
      role: 'owner',
      organizationId: 'org_1',
      organization: {
        id: 'org_1',
        name: 'Acme Insurance',
        slug: 'acme-insurance',
        plan: 'pro',
      },
    })
    mockAuth.verifyPassword.mockReturnValueOnce(true)

    const request = new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      body: JSON.stringify({
        action: 'login',
        email: 'owner@example.com',
        password: 'supersecure123',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.authenticated).toBe(true)
    expect(json.user.organizationId).toBe('org_1')
    expect(mockDb.userSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_1',
        token: 'hashed_session_token',
        isActive: true,
        expiresAt: expect.any(Date),
        lastActiveAt: expect.any(Date),
        device: 'macOS device',
        browser: 'Chrome',
        os: 'macOS',
        ip: '127.0.0.1',
      }),
    })
    expect(mockDb.auditLog.create).toHaveBeenCalledOnce()
  })

  it('changes the password for an authenticated invited user', async () => {
    mockDb.userSession.findFirst.mockResolvedValueOnce({
      id: 'session_1',
      user: {
        id: 'user_1',
        email: 'owner@example.com',
        organizationId: 'org_1',
        passwordHash: 'stored-hash',
        preferences: { requirePasswordChange: true },
      },
    })
    mockAuth.getCurrentSessionFromToken.mockResolvedValueOnce({
      sessionId: 'session_1',
      expiresAt: new Date('2026-03-20T00:00:00.000Z'),
      user: {
        id: 'user_1',
        email: 'owner@example.com',
        name: 'Owner',
        role: 'owner',
        organizationId: 'org_1',
        preferences: { requirePasswordChange: true },
        organization: { id: 'org_1', name: 'Acme', slug: 'acme', plan: 'pro', settings: {} },
      },
    })
    mockAuth.verifyPassword.mockReturnValueOnce(true)
    mockDb.$transaction.mockImplementationOnce(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
      callback({
        user: {
          update: vi.fn(async () => ({ id: 'user_1' })),
        },
        userSession: {
          updateMany: vi.fn(async () => ({ count: 1 })),
          create: vi.fn(async () => ({ id: 'session_2' })),
        },
        auditLog: {
          create: vi.fn(async () => ({ id: 'audit_1' })),
        },
      }),
    )

    const request = new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      body: JSON.stringify({
        action: 'change-password',
        currentPassword: 'temp-pass',
        newPassword: 'supersecure123',
      }),
      headers: {
        'Content-Type': 'application/json',
        cookie: 'session-token=session_token',
      },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockDb.$transaction).toHaveBeenCalledOnce()
    expect(response.cookies.get('session-token')?.value).toBe('session_token')
  })

  it('accepts a team invitation and creates a session', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({
      id: 'user_2',
      email: 'agent@example.com',
      name: 'Agent Smith',
      role: 'member',
      organizationId: 'org_1',
      passwordHash: null,
      preferences: {
        inviteTokenHash: 'hashed_session_token',
        inviteTokenExpiresAt: '2099-03-20T00:00:00.000Z',
      },
      organization: {
        id: 'org_1',
        name: 'Acme Insurance',
        slug: 'acme-insurance',
        plan: 'pro',
      },
    })
    mockDb.$transaction.mockImplementationOnce(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
      callback({
        user: {
          update: vi.fn(async () => ({
            id: 'user_2',
            email: 'agent@example.com',
            name: 'Agent Smith',
            role: 'member',
            organizationId: 'org_1',
            preferences: {
              invitedAcceptedAt: '2026-03-19T22:00:00.000Z',
            },
            organization: {
              id: 'org_1',
              name: 'Acme Insurance',
              slug: 'acme-insurance',
              plan: 'pro',
            },
          })),
        },
        userSession: {
          updateMany: vi.fn(async () => ({ count: 0 })),
          create: vi.fn(async () => ({ id: 'session_3' })),
        },
        auditLog: {
          create: vi.fn(async () => ({ id: 'audit_2' })),
        },
      }),
    )

    const request = new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      body: JSON.stringify({
        action: 'accept-invite',
        email: 'agent@example.com',
        token: 'session_token_12345',
        password: 'supersecure123',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.authenticated).toBe(true)
    expect(json.user.email).toBe('agent@example.com')
    expect(response.cookies.get('session-token')?.value).toBe('session_token')
  })

  it('clears the cookie and invalidates the session on sign out', async () => {
    mockDb.userSession.findFirst.mockResolvedValueOnce({
      id: 'session_1',
      user: {
        id: 'user_1',
        email: 'owner@example.com',
        organizationId: 'org_1',
      },
    })

    const request = new NextRequest('http://localhost/api/auth', {
      method: 'DELETE',
      headers: { cookie: 'session-token=session_token' },
    })

    const response = await DELETE(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(mockAuth.invalidateSessionToken).toHaveBeenCalledWith('session_token')
    expect(mockDb.auditLog.create).toHaveBeenCalledOnce()
  })

  it('rejects cross-site auth mutations', async () => {
    const request = new NextRequest('http://localhost/api/auth', {
      method: 'POST',
      body: JSON.stringify({
        action: 'login',
        email: 'owner@example.com',
        password: 'supersecure123',
      }),
      headers: {
        'Content-Type': 'application/json',
        origin: 'https://evil.example',
      },
    })

    const response = await POST(request)
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toBe('Cross-site request blocked')
  })
})
