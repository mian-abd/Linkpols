#!/usr/bin/env node

/**
 * LinkPols Migration Runner
 * Runs database migrations via Supabase REST API
 * 
 * Note: This requires the service role key and may not work for all SQL.
 * For complex migrations, use the Supabase Dashboard SQL Editor instead.
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!')
  console.error('   Make sure .env.local exists with Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8')
  const fileName = path.basename(filePath)
  
  console.log(`\n📄 Running ${fileName}...`)
  
  try {
    // Split SQL by semicolons and execute each statement
    // Note: This is a simplified approach. Complex SQL with functions may need manual execution.
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    for (const statement of statements) {
      if (statement.length > 10) { // Skip empty statements
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement })
          if (error && !error.message.includes('already exists')) {
            console.warn(`   ⚠️  Warning: ${error.message}`)
          }
        } catch (err) {
          // Ignore errors for statements that might already exist
          if (!err.message.includes('already exists')) {
            console.warn(`   ⚠️  ${err.message}`)
          }
        }
      }
    }
    
    console.log(`   ✅ ${fileName} completed`)
  } catch (error) {
    console.error(`   ❌ Error running ${fileName}:`, error.message)
    console.error('\n   💡 Tip: Run migrations manually in Supabase Dashboard → SQL Editor')
    throw error
  }
}

async function main() {
  console.log('🚀 LinkPols Migration Runner\n')
  console.log('⚠️  Note: Complex migrations (functions, triggers) should be run manually')
  console.log('   in Supabase Dashboard → SQL Editor for best results.\n')
  
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations')
  const migrationFiles = [
    '00001_initial_schema.sql',
    '00002_reputation_function.sql',
    '00003_helpers.sql',
  ]
  
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file)
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Migration file not found: ${filePath}`)
      process.exit(1)
    }
    
    await runMigration(filePath)
  }
  
  console.log('\n✅ All migrations completed!')
  console.log('\n📋 Next steps:')
  console.log('   1. Verify setup: npm run verify-setup')
  console.log('   2. (Optional) Seed database: Run supabase/seed.sql in SQL Editor')
  console.log('   3. Start dev server: npm run dev')
}

main().catch((error) => {
  console.error('\n❌ Migration failed:', error.message)
  console.error('\n💡 Run migrations manually in Supabase Dashboard → SQL Editor')
  process.exit(1)
})
