#!/usr/bin/env node
/**
 * Release Creator Script
 *
 * Creates a git tag for a new release following semver. Automatically
 * determines the next version based on the commit types since the last tag:
 *   - Any `feat:` commit → minor bump (v1.2.0 → v1.3.0)
 *   - Only `fix:` / `chore:` commits → patch bump (v1.2.0 → v1.2.1)
 *   - Any `feat!:` or `BREAKING CHANGE:` → major bump (v1.2.0 → v2.0.0)
 *
 * Usage:
 *   node scripts/create-release.mjs          # auto-detect bump type
 *   node scripts/create-release.mjs patch    # force patch bump
 *   node scripts/create-release.mjs minor    # force minor bump
 *   node scripts/create-release.mjs major    # force major bump
 *
 * After running, push the tag:
 *   git push origin <tag>
 * This triggers the release.yml workflow to create a GitHub Release.
 */

import { execSync } from 'child_process'

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim()
}

// Get the last tag
let lastTag
try {
  lastTag = run('git describe --tags --abbrev=0')
} catch {
  lastTag = null
  console.log('ℹ️  No previous tags found — this will be the first release')
}

// Get commits since last tag
let commits
try {
  const range = lastTag ? `${lastTag}..HEAD` : 'HEAD'
  commits = run(`git log ${range} --pretty=format:"%s"`).split('\n').filter(Boolean)
} catch {
  commits = []
}

console.log(`\n📋 Commits since ${lastTag || 'beginning'}:`)
commits.forEach(c => console.log(`   ${c}`))

// Determine bump type
const forcedBump = process.argv[2]?.toLowerCase()
let bumpType = 'patch'

if (forcedBump && ['patch', 'minor', 'major'].includes(forcedBump)) {
  bumpType = forcedBump
  console.log(`\n📌 Using forced bump: ${bumpType}`)
} else {
  const hasBreaking = commits.some(c => c.includes('BREAKING CHANGE') || /^[a-z]+!:/.test(c))
  const hasFeature = commits.some(c => /^feat[\((!]/.test(c) || c.startsWith('feat:'))
  const hasFix = commits.some(c => /^fix[\((!]/.test(c) || c.startsWith('fix:'))

  if (hasBreaking) {
    bumpType = 'major'
  } else if (hasFeature) {
    bumpType = 'minor'
  } else {
    bumpType = 'patch'
  }
  console.log(`\n📌 Auto-detected bump: ${bumpType} (breaking: ${hasBreaking}, feat: ${hasFeature}, fix: ${hasFix})`)
}

// Calculate next version
let nextVersion
if (!lastTag) {
  nextVersion = 'v0.1.0'
} else {
  const clean = lastTag.replace(/^v/, '')
  const [major, minor, patch] = clean.split('.').map(Number)
  if (bumpType === 'major') {
    nextVersion = `v${major + 1}.0.0`
  } else if (bumpType === 'minor') {
    nextVersion = `v${major}.${minor + 1}.0`
  } else {
    nextVersion = `v${major}.${minor}.${patch + 1}`
  }
}

console.log(`\n🏷️  Creating tag: ${nextVersion}`)
console.log(`   Previous: ${lastTag || '(none)'}`)

// Confirm
const { createInterface } = await import('readline')
const rl = createInterface({ input: process.stdin, output: process.stdout })
const answer = await new Promise(resolve => {
  rl.question(`\n   Proceed? (yes/no): `, resolve)
})
rl.close()

if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
  console.log('   Cancelled.')
  process.exit(0)
}

// Create the tag
run(`git tag ${nextVersion} -m "Release ${nextVersion}"`)
console.log(`\n✅ Tag created: ${nextVersion}`)
console.log(`\nNext step — push the tag to trigger the GitHub Release workflow:`)
console.log(`   git push origin ${nextVersion}`)
