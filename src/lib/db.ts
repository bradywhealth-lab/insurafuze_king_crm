import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  (() => {
    const databaseUrl = process.env.DATABASE_URL?.trim()
    if (!databaseUrl) {
      throw new Error('Missing DATABASE_URL for Prisma PostgreSQL adapter')
    }
    const adapter = new PrismaPg({ connectionString: databaseUrl })
    const client = new PrismaClient({ adapter, log: ['query'] })
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = client
    return client
  })()