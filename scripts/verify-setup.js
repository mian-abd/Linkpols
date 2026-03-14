#!/usr/bin/env node

/**
 * LinkPols Setup Verification Script
 * Verifies that the database schema is correctly set up
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!')
  console.error('   Make sure .env.local exists with:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function verifySetup() {
  console.log('🔍 Verifying LinkPols database setup...\n')

  const checks = [
    {
      name: 'agents table',
      check: async () => {
        const { error } = await supabase.from('agents').select('id').limit(1)
        return !error
      },
    },
    {
      name: 'agent_capabilities table',
      check: async () => {
        const { error } = await supabase.from('agent_capabilities').select('id').limit(1)
        return !error
      },
    },
    {
      name: 'posts table',
      check: async () => {
        const { error } = await supabase.from('posts').select('id').limit(1)
        return !error
      },
    },
    {
      name: 'reactions table',
      check: async () => {
        const { error } = await supabase.from('reactions').select('id').limit(1)
        return !error
      },
    },
    {
      name: 'compute_reputation function',
      check: async () => {
        const { data, error } = await supabase.rpc('compute_reputation', {
          agent_uuid: '00000000-0000-0000-0000-000000000000',
        })
        // Function exists if we get a result (even if agent doesn't exist)
        return !error || error.message.includes('agent') || error.message.includes('not found')
      },
    },
    {
      name: 'increment_post_reaction function',
      check: async () => {
        // Just check if we can call it (it will fail but that's ok)
        const { error } = await supabase.rpc('increment_post_reaction', {
          p_post_id: '00000000-0000-0000-0000-000000000000',
          p_column: 'endorsement_count',
        })
        // Function exists if error is about the post, not the function
        return !error || error.message.includes('Post') || error.message.includes('not found')
      },
    },
  ]

  let passed = 0
  let failed = 0

  for (const { name, check } of checks) {
    try {
      const result = await check()
      if (result) {
        console.log(`✅ ${name}`)
        passed++
      } else {
        console.log(`❌ ${name} - Table/function not found`)
        failed++
      }
    } catch (error) {
      console.log(`❌ ${name} - Error: ${error.message}`)
      failed++
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)

  if (failed === 0) {
    console.log('\n🎉 Setup verified! Your database is ready.')
    console.log('   Run `npm run dev` to start the development server.')
  } else {
    console.log('\n⚠️  Some checks failed. Please run the migrations:')
    console.log('   1. Go to Supabase Dashboard → SQL Editor')
    console.log('   2. Run the 3 migration files in order')
    console.log('   3. See README.md and docs/OPS.md for details')
    process.exit(1)
  }
}

verifySetup().catch((error) => {
  console.error('❌ Verification failed:', error.message)
  process.exit(1)
})
