#!/usr/bin/env node
/**
 * Operational Runner Script
 *
 * Calls the two internal automation endpoints:
 *   1. /api/sequences/run   — processes due sequence steps (email/SMS follow-ups)
 *   2. /api/content/publish — publishes scheduled content posts
 *
 * Called by:
 *   - GitHub Actions cron (every 15 min via .github/workflows/cron-runner.yml)
 *   - Manually: node scripts/run-internal-runners.mjs
 *   - npm script: bun run runner:tick
 *
 * Required environment variables:
 *   APP_BASE_URL           — e.g., https://your-app.example.com
 *   INTERNAL_RUNNER_KEY    — must match INTERNAL_RUNNER_KEY in app .env
 *   RUNNER_ORGANIZATION_ID — organizationId to process automations for
 */

const baseUrl = process.env.APP_BASE_URL
const internalRunnerKey = process.env.INTERNAL_RUNNER_KEY
const organizationId = process.env.RUNNER_ORGANIZATION_ID

if (!baseUrl) {
  console.error('❌ Missing APP_BASE_URL environment variable')
  process.exit(1)
}
if (!internalRunnerKey) {
  console.error('❌ Missing INTERNAL_RUNNER_KEY environment variable')
  process.exit(1)
}
if (!organizationId) {
  console.error('❌ Missing RUNNER_ORGANIZATION_ID environment variable')
  process.exit(1)
}

const headers = {
  'Content-Type': 'application/json',
  'x-internal-runner-key': internalRunnerKey,
  'x-organization-id': organizationId,
}

const TIMEOUT_MS = 30_000

async function callRunner(label, path, body) {
  const start = Date.now()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    console.log(`⏳ [${label}] Starting...`)
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const elapsed = Date.now() - start
    const text = await res.text()

    if (!res.ok) {
      console.error(`❌ [${label}] HTTP ${res.status} after ${elapsed}ms: ${text}`)
      throw new Error(`${path} failed (${res.status}): ${text}`)
    }

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }

    console.log(`✅ [${label}] OK (${elapsed}ms):`, JSON.stringify(parsed))
    return parsed
  } catch (err) {
    clearTimeout(timeoutId)
    if (err.name === 'AbortError') {
      throw new Error(`[${label}] Timed out after ${TIMEOUT_MS}ms`)
    }
    throw err
  }
}

async function main() {
  const runAt = new Date().toISOString()
  console.log(`\n🚀 Elite CRM Runner Tick — ${runAt}`)
  console.log(`   Target: ${baseUrl}`)
  console.log(`   Org: ${organizationId}\n`)

  const results = { sequences: null, content: null, errors: [] }

  try {
    results.sequences = await callRunner('Sequences', '/api/sequences/run', {})
  } catch (err) {
    results.errors.push(err.message)
    console.error(`❌ Sequences runner failed: ${err.message}`)
  }

  try {
    results.content = await callRunner('Content', '/api/content/publish', { limit: 25 })
  } catch (err) {
    results.errors.push(err.message)
    console.error(`❌ Content runner failed: ${err.message}`)
  }

  console.log('\n📊 Runner Summary:')
  console.log(`   Sequences: ${results.sequences ? 'OK' : 'FAILED'}`)
  console.log(`   Content:   ${results.content ? 'OK' : 'FAILED'}`)

  if (results.errors.length > 0) {
    console.error(`\n⚠️  ${results.errors.length} error(s) occurred`)
    process.exit(1)
  }

  console.log('\n✅ All runners completed successfully\n')
}

main().catch((err) => {
  console.error('\n💥 Fatal runner error:', err.message)
  process.exit(1)
})
