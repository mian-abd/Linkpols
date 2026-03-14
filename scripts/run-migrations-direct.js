#!/usr/bin/env node

/**
 * LinkPols Migration Runner - Direct Postgres Connection
 * Runs migrations directly via Postgres connection
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

// Use the exact connection string format from Supabase
// Format: postgresql://postgres:password@host:port/database
// Password with @ needs to be URL encoded as %40
const connectionString = process.env.DATABASE_URL || 
  'postgresql://postgres:Newgames%4012345@db.uvhizmsytaomdyfmpogi.supabase.co:5432/postgres'

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Supabase requires SSL
  },
  connectionTimeoutMillis: 10000
})

async function runMigration() {
  const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', 'ALL_MIGRATIONS.sql')
  
  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ Migration file not found: ${migrationFile}`)
    process.exit(1)
  }
  
  const sql = fs.readFileSync(migrationFile, 'utf8')
  
  console.log('🚀 Running LinkPols database migrations...\n')
  console.log('📄 File: ALL_MIGRATIONS.sql\n')
  
  try {
    await client.connect()
    console.log('✅ Connected to database\n')
    
    // Execute the entire SQL file
    // Split by semicolons but preserve function definitions
    const statements = sql
      .split(/;(?=\s*$)/m)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.match(/^\s*--/))
    
    let executed = 0
    let errors = 0
    
    // Execute statements one by one
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim()
      
      // Skip empty statements and comments
      if (!statement || statement.startsWith('--')) continue
      
      // Skip verification queries (commented out)
      if (statement.includes('-- Uncomment to verify')) continue
      
      try {
        await client.query(statement)
        executed++
        
        // Show progress for major sections
        if (statement.includes('CREATE TABLE') || statement.includes('CREATE FUNCTION') || statement.includes('CREATE EXTENSION')) {
          const match = statement.match(/CREATE\s+(?:TABLE|FUNCTION|EXTENSION)\s+(?:IF NOT EXISTS\s+)?["']?(\w+)["']?/i)
          if (match) {
            console.log(`   ✅ ${match[1]}`)
          }
        }
      } catch (err) {
        // Ignore "already exists" errors
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          // Silent skip
        } else {
          console.error(`   ⚠️  Error: ${err.message.split('\n')[0]}`)
          errors++
        }
      }
    }
    
    console.log(`\n📊 Executed ${executed} statements${errors > 0 ? `, ${errors} warnings` : ''}`)
    
    // Verify setup
    console.log('\n🔍 Verifying setup...\n')
    
    const tables = ['agents', 'agent_capabilities', 'posts', 'reactions']
    for (const table of tables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table])
      
      if (result.rows[0].exists) {
        console.log(`✅ Table '${table}' exists`)
      } else {
        console.log(`❌ Table '${table}' missing`)
      }
    }
    
    const functions = ['compute_reputation', 'recompute_all_reputations', 'increment_post_reaction']
    for (const func of functions) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.routines 
          WHERE routine_schema = 'public' 
          AND routine_name = $1
        )
      `, [func])
      
      if (result.rows[0].exists) {
        console.log(`✅ Function '${func}' exists`)
      } else {
        console.log(`❌ Function '${func}' missing`)
      }
    }
    
    console.log('\n🎉 Migration completed successfully!')
    console.log('\n📋 Next steps:')
    console.log('   - Run: npm run verify-setup (optional)')
    console.log('   - Run: npm run dev')
    console.log('   - (Optional) Seed database: Run supabase/seed.sql in SQL Editor')
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message)
    if (error.message.includes('password authentication failed')) {
      console.error('   Check your database password in the connection string')
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('   Check your database host and port')
    }
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration().catch((error) => {
  console.error('\n❌ Fatal error:', error.message)
  process.exit(1)
})
