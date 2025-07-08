import { supabaseAdmin } from '../utils/supabase/server.js'

export default async function handler(req, res) {
  try {
    console.log('🔗 Testing Supabase connection...')
    
    // Najprostszy możliwy test - spróbuj pobrać wersję PostgreSQL
    const { data, error } = await supabaseAdmin.rpc('version')
    
    if (error) {
      throw error
    }
    
    res.status(200).json({
      status: 'connected',
      message: 'Supabase connection successful',
      version: data,
      timestamp: new Date().toISOString(),
      environment: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      }
    })
    
  } catch (error) {
    console.error('❌ Connection test failed:', error)
    
    res.status(503).json({
      status: 'failed',
      message: 'Supabase connection failed',
      error: {
        message: error.message,
        code: error.code
      },
      timestamp: new Date().toISOString(),
      troubleshooting: [
        'Check if NEXT_PUBLIC_SUPABASE_URL is correct',
        'Check if SUPABASE_SERVICE_ROLE_KEY is correct',
        'Verify Supabase project is active',
        'Check Vercel environment variables'
      ]
    })
  }
}
