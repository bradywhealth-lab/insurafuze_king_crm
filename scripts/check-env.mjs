#!/usr/bin/env node
/**
 * Environment Variable Checker
 *
 * Validates that all required and optional environment variables are set,
 * and warns about any that are using placeholder values.
 *
 * Usage:
 *   node scripts/check-env.mjs
 *   node scripts/check-env.mjs --strict   # exit 1 if any required var missing
 *
 * Run this before deploying to catch missing configuration.
 */

const STRICT = process.argv.includes('--strict')

// Load .env if it exists
try {
  const { readFileSync } = await import('fs')
  const env = readFileSync('.env', 'utf8')
  for (const line of env.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
} catch {
  // .env doesn't exist — that's fine
}

const REQUIRED = [
  { key: 'DATABASE_URL', description: 'PostgreSQL connection string' },
  { key: 'NEXTAUTH_SECRET', description: 'NextAuth secret for session encryption' },
  { key: 'NEXTAUTH_URL', description: 'App base URL for NextAuth redirects' },
]

const RECOMMENDED = [
  { key: 'OPENAI_API_KEY', description: 'OpenAI API key for AI features' },
  { key: 'INTERNAL_RUNNER_KEY', description: 'Internal runner authentication key' },
  { key: 'APP_BASE_URL', description: 'Production app URL (for runner scripts + health checks)' },
  { key: 'RUNNER_ORGANIZATION_ID', description: 'Organization ID for runner automation' },
]

const OPTIONAL = [
  { key: 'SUPABASE_URL', description: 'Supabase URL for document storage' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase service role key' },
  { key: 'ANTHROPIC_API_KEY', description: 'Anthropic Claude API key (alternative to OpenAI)' },
  { key: 'GOOGLE_API_KEY', description: 'Google AI API key' },
  { key: 'LINEAR_API_KEY', description: 'Linear.app API key for issue integration' },
  { key: 'SCRAPINGBEE_API_KEY', description: 'ScrapingBee API key for lead scraping' },
  { key: 'FIRECRAWL_API_KEY', description: 'Firecrawl API key for web scraping' },
  { key: 'HEALTH_SLACK_WEBHOOK', description: 'Slack webhook for health check alerts' },
]

const PLACEHOLDER_PATTERNS = ['placeholder', 'your-', 'xxx', 'changeme', 'secret-here', 'api-key-here']

function isPlaceholder(val) {
  if (!val) return false
  const lower = val.toLowerCase()
  return PLACEHOLDER_PATTERNS.some(p => lower.includes(p))
}

function checkVar(key) {
  const val = process.env[key]
  if (!val || val.trim() === '') return { status: 'missing', val: null }
  if (isPlaceholder(val)) return { status: 'placeholder', val }
  return { status: 'set', val }
}

let hasErrors = false
let hasWarnings = false

console.log('\n🔍 Elite CRM Environment Check\n')

console.log('── REQUIRED ───────────────────────────────────────────────')
for (const { key, description } of REQUIRED) {
  const { status, val } = checkVar(key)
  if (status === 'missing') {
    console.log(`❌ ${key.padEnd(35)} MISSING — ${description}`)
    hasErrors = true
  } else if (status === 'placeholder') {
    console.log(`⚠️  ${key.padEnd(35)} PLACEHOLDER — replace with real value`)
    hasWarnings = true
  } else {
    const display = key.includes('KEY') || key.includes('SECRET') || key.includes('URL')
      ? val.slice(0, 20) + '...'
      : val.slice(0, 40)
    console.log(`✅ ${key.padEnd(35)} ${display}`)
  }
}

console.log('\n── RECOMMENDED ─────────────────────────────────────────────')
for (const { key, description } of RECOMMENDED) {
  const { status, val } = checkVar(key)
  if (status === 'missing') {
    console.log(`⚠️  ${key.padEnd(35)} NOT SET — ${description}`)
    hasWarnings = true
  } else if (status === 'placeholder') {
    console.log(`⚠️  ${key.padEnd(35)} PLACEHOLDER — ${description}`)
    hasWarnings = true
  } else {
    const display = key.includes('KEY') || key.includes('SECRET') || key.includes('URL')
      ? val.slice(0, 20) + '...'
      : val.slice(0, 40)
    console.log(`✅ ${key.padEnd(35)} ${display}`)
  }
}

console.log('\n── OPTIONAL ────────────────────────────────────────────────')
for (const { key, description } of OPTIONAL) {
  const { status } = checkVar(key)
  if (status === 'missing') {
    console.log(`   ${key.padEnd(35)} not set (${description})`)
  } else if (status === 'placeholder') {
    console.log(`   ${key.padEnd(35)} placeholder`)
  } else {
    console.log(`✅ ${key.padEnd(35)} set`)
  }
}

console.log('')
if (hasErrors) {
  console.log('❌ Missing required variables — app will not function correctly\n')
  if (STRICT) process.exit(1)
} else if (hasWarnings) {
  console.log('⚠️  Some variables are missing or use placeholders — some features degraded\n')
} else {
  console.log('✅ All environment variables look good\n')
}
