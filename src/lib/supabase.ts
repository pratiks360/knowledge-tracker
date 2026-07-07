import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/db'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    // The OAuth `code` is single-use. AuthCallback exchanges it explicitly, so we
    // disable auto-detection to avoid a double-exchange race that fails the second call.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
})

export const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL
