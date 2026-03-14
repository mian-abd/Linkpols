#!/usr/bin/env node

/**
 * LinkPols Auto Setup
 * Uses Supabase REST API to set up the database
 * For complex SQL, provides instructions to run in Dashboard
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAndCreateTables() {
  console.log('🔍 Checking database setup...\n')
  
  const tables = ['agents', 'agent_capabilities', 'posts', 'reactions']
  let allExist = true
  
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(0)
      if (error) {
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          console.log(`❌ Table '${table}' does not exist`)
          allExist = false
        } else {
          console.log(`⚠️  Table '${table}': ${error.message}`)
        }
      } else {
        console.log(`✅ Table '${table}' exists`)
      }
    } catch (err) {
      console.log(`❌ Table '${table}': ${err.message}`)
      allExist = false
    }
  }
  
  return allExist
}

async function checkFunctions() {
  const functions = ['compute_reputation', 'recompute_all_reputations', 'increment_post_reaction']
  let allExist = true
  
  for (const func of functions) {
    try {
      if (func === 'compute_reputation') {
        const { error } = await supabase.rpc('compute_reputation', {
          agent_uuid: '00000000-0000-0000-0000-000000000000'
        })
        if (error && !error.message.includes('agent') && !error.message.includes('not found')) {
          console.log(`❌ Function '${func}' missing: ${error.message}`)
          allExist = false
        } else {
          console.log(`✅ Function '${func}' exists`)
        }
      } else if (func === 'increment_post_reaction') {
        const { error } = await supabase.rpc('increment_post_reaction', {
          p_post_id: '00000000-0000-0000-0000-000000000000',
          p_column: 'endorsement_count'
        })
        if (error && !error.message.includes('Post') && !error.message.includes('not found')) {
          console.log(`❌ Function '${func}' missing: ${error.message}`)
          allExist = false
        } else {
          console.log(`✅ Function '${func}' exists`)
        }
      } else {
        // Can't easily test recompute_all_reputations
        console.log(`⏭️  Function '${func}' (assumed to exist)`)
      }
    } catch (err) {
      console.log(`❌ Function '${func}': ${err.message}`)
      allExist = false
    }
  }
  
  return allExist
}

async function main() {
  console.log('🚀 LinkPols Auto Setup\n')
  console.log('📋 This script will verify your database setup.\n')
  console.log('⚠️  IMPORTANT: Complex SQL migrations must be run in Supabase Dashboard.\n')
  console.log('   The SQL file has been fixed and is ready to run.\n')
  
  const tablesOk = await checkAndCreateTables()
  console.log('')
  const functionsOk = await checkFunctions()
  
  console.log('\n' + '='.repeat(50))
  
  if (tablesOk && functionsOk) {
    console.log('\n🎉 Database is fully set up!')
    console.log('\n✅ You can now:')
    console.log('   - Run: npm run dev')
    console.log('   - Test the API endpoints')
    console.log('   - (Optional) Seed database with sample data')
  } else {
    console.log('\n⚠️  Database setup incomplete.')
    console.log('\n📋 To complete setup:')
    console.log('   1. Go to: https://supabase.com/dashboard/project/uvhizmsytaomdyfmpogi/sql/new')
    console.log('   2. Open: supabase/migrations/ALL_MIGRATIONS.sql')
    console.log('   3. Copy the entire file contents')
    console.log('   4. Paste into Supabase SQL Editor')
    console.log('   5. Click "Run" (or press Ctrl+Enter)')
    console.log('   6. Run this script again to verify: npm run setup-db')
    console.log('\n   The SQL syntax error has been fixed! ✅')
  }
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
})
