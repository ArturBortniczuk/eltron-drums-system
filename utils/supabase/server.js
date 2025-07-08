import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

// Klient z service role key dla operacji serwerowych
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Funkcja pomocnicza do wykonywania SQL queries (kompatybilna z poprzednim kodem)
export const sql = async (query, params = []) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('execute_sql', {
      query_text: query,
      params: params
    })
    
    if (error) throw error
    return { rows: data }
  } catch (error) {
    // Fallback - użyj normalnych operacji Supabase
    console.warn('SQL query failed, using Supabase operations:', error.message)
    throw error
  }
}

// Export dla template literals (kompatybilność z @vercel/postgres)
export const sqlTemplate = (strings, ...values) => {
  let query = ''
  for (let i = 0; i < strings.length; i++) {
    query += strings[i]
    if (i < values.length) {
      query += `$${i + 1}`
    }
  }
  return sql(query, values)
}
