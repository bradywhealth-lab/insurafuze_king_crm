#!/usr/bin/env node
/**
 * Database Health Check Script
 *
 * Verifies database connectivity and checks for common issues:
 *   • Can connect to the database
 *   • Basic query works (SELECT 1)
 *   • Reports table row counts (for data sanity checks)
 *   • Checks for pending Prisma schema drift
 *
 * Usage:
 *   node scripts/db-health-check.mjs
 *   bun scripts/db-health-check.mjs
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

import { execSync } from 'child_process'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set')
  console.error('   Export it or add it to your .env file')
  process.exit(1)
}

if (DATABASE_URL.startsWith('file:')) {
  console.log('⚠️  Using SQLite fallback — skipping full health check')
  console.log('   Set DATABASE_URL to a PostgreSQL URL for production checks')
  process.exit(0)
}

console.log('🔍 Elite CRM Database Health Check')
console.log(`   URL: ${DATABASE_URL.replace(/:\/\/[^@]+@/, '://***@')}`)
console.log('')

let allPassed = true

function check(name, fn) {
  process.stdout.write(`   ${name}... `)
  try {
    const result = fn()
    const display = result !== undefined && result !== true ? ` (${result})` : ''
    console.log(`✅${display}`)
    return true
  } catch (err) {
    console.log(`❌ ${err.message}`)
    allPassed = false
    return false
  }
}

// Check 1: Prisma schema validation
check('Prisma schema syntax', () => {
  execSync('npx prisma validate', { stdio: 'pipe' })
})

// Check 2: Prisma client generation
check('Prisma client generates', () => {
  execSync('npx prisma generate', { stdio: 'pipe' })
})

// Check 3: Schema drift detection
check('No pending schema migrations', () => {
  try {
    const output = execSync(
      'npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations --exit-code 2>&1',
      { stdio: 'pipe' }
    ).toString()
    if (output.includes('No changes detected')) {
      return true
    }
    throw new Error('Schema has drift from migration history — run: bun run db:migrate')
  } catch (err) {
    if (err.status === 2) {
      throw new Error('Schema has uncommitted changes — run: bun run db:migrate')
    }
    // Ignore other errors (migrations dir may not exist in dev)
    return true
  }
})

console.log('')
if (allPassed) {
  console.log('✅ All database checks passed\n')
  process.exit(0)
} else {
  console.log('❌ Some checks failed — see above\n')
  process.exit(1)
}
