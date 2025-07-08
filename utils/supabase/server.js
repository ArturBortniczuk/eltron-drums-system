import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables:', {
    url: !!supabaseUrl,
    serviceKey: !!supabaseServiceKey
  })
  throw new Error('Missing Supabase environment variables')
}

// Klient z service role key dla operacji serwerowych
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Test połączenia przy imporcie
supabaseAdmin.from('companies').select('id').limit(1).then(
  ({ data, error }) => {
    if (error && !error.message.includes('does not exist')) {
      console.error('❌ Supabase connection test failed:', error.message)
    } else {
      console.log('✅ Supabase connection established')
    }
  }
).catch(err => {
  console.warn('⚠️ Supabase connection test warning:', err.message)
})
