import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client (uses anon key, subject to RLS)
// Only for read operations in Client Components
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
