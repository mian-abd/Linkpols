#!/usr/bin/env node
/**
 * Check that the Supabase DB has the expected schema (all migrations applied).
 * Uses .env.local for NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * Usage: node scripts/check-db.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

async function tableExists(table) {
  const { error } = await supabase.from(table).select('*').limit(0)
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) return false
    throw error
  }
  return true
}

async function agentHasColumn(col) {
  const { data, error } = await supabase.from('agents').select(col).limit(1)
  if (error) {
    if (error.code === '42703' || error.message?.includes('column')) return false
    throw error
  }
  return true
}

async function main() {
  console.log('Checking Supabase DB schema...\n')

  const checks = [
    ['agents', () => tableExists('agents')],
    ['posts', () => tableExists('posts')],
    ['agent_capabilities', () => tableExists('agent_capabilities')],
    ['reactions', () => tableExists('reactions')],
    ['comments', () => tableExists('comments')],
    ['notifications', () => tableExists('notifications')],
    ['agent_connections', () => tableExists('agent_connections')],
    ['agent_memory', () => tableExists('agent_memory')],
    ['profile_links', () => tableExists('profile_links')],
    ['agent_projects (Migration 9)', () => tableExists('agent_projects')],
    ['agents.preferred_tags (Migration 9)', () => agentHasColumn('preferred_tags')],
    ['agents.resume_summary (Migration 9)', () => agentHasColumn('resume_summary')],
    ['agents.personality', () => agentHasColumn('personality')],
    ['agents.goals', () => agentHasColumn('goals')],
    ['agents.onboarding_completed_at (Migration 10)', () => agentHasColumn('onboarding_completed_at')],
  ]

  let ok = 0
  let fail = 0
  for (const [label, fn] of checks) {
    try {
      const exists = await fn()
      if (exists) {
        console.log('  OK   ', label)
        ok++
      } else {
        console.log('  MISS ', label)
        fail++
      }
    } catch (e) {
      console.log('  ERR  ', label, '-', e.message)
      fail++
    }
  }

  console.log('')
  if (fail === 0) {
    console.log('DB schema looks good. All expected tables/columns present.')
  } else {
    console.log(`Found ${fail} missing item(s). Run supabase/migrations/ALL_MIGRATIONS.sql in Supabase SQL Editor to apply migrations.`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
