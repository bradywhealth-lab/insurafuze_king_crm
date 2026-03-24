import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string
      role: string
      organizationId: string
      organization: {
        id: string
        name: string
        slug: string
        plan: string
      }
      preferences: unknown
      mustChangePassword: boolean
    }
  }

  interface User {
    role: string
    organizationId: string
    organization: {
      id: string
      name: string
      slug: string
      plan: string
    }
    preferences: unknown
  }
}
