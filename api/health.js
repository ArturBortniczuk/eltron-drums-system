import { supabaseAdmin } from '../utils/supabase/server.js'

export default async function handler(req, res) {
  try {
    console.log('🏥 Starting Supabase health check...')
    
    // 1. Test podstawowego połączenia
    const { data: connectionTest, error: connectionError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .limit(1)
    
    if (connectionError) {
      throw connectionError
    }
    
    console.log('✅ Basic connection test passed')
    
    // 2. Sprawdź czy istnieją kluczowe tabele
    const requiredTables = ['companies', 'drums', 'users', 'admin_users', 'return_requests']
    const tableChecks = {}
    
    for (const tableName of requiredTables) {
      try {
        const { data, error } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .limit(1)
        
        tableChecks[tableName] = !error
      } catch (error) {
        tableChecks[tableName] = false
        console.warn(`⚠️ Error checking table ${tableName}:`, error.message)
      }
    }

    // 3. Sprawdź czy wszystkie wymagane tabele istnieją
    const missingTables = requiredTables.filter(table => !tableChecks[table])
    const allTablesExist = missingTables.length === 0

    // 4. Sprawdź liczbę rekordów w kluczowych tabelach
    const tableCounts = {}
    if (allTablesExist) {
      for (const tableName of requiredTables) {
        try {
          const { count, error } = await supabaseAdmin
            .from(tableName)
            .select('*', { count: 'exact', head: true })
          
          tableCounts[tableName] = error ? 0 : count
        } catch (error) {
          tableCounts[tableName] = 0
        }
      }
    }

    // 5. Sprawdź konfigurację Supabase
    const supabaseConfig = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'missing'
    }

    // 6. Określ ogólny status
    let overallStatus = 'healthy'
    let statusMessage = 'Supabase database is fully operational'
    
    if (!allTablesExist) {
      overallStatus = 'degraded'
      statusMessage = `Database schema incomplete. Missing tables: ${missingTables.join(', ')}`
    } else if (Object.values(tableCounts).every(count => count === 0)) {
      overallStatus = 'warning'
      statusMessage = 'Database schema exists but no data found. Run setup/migration.'
    }

    console.log(`🏥 Health check completed with status: ${overallStatus}`)

    res.status(overallStatus === 'healthy' ? 200 : 503).json({
      status: overallStatus,
      message: statusMessage,
      timestamp: new Date().toISOString(),
      database: {
        type: 'Supabase PostgreSQL',
        connection: 'OK',
        schema: {
          status: allTablesExist ? 'complete' : 'incomplete',
          requiredTables: requiredTables.length,
          existingTables: requiredTables.filter(table => tableChecks[table]).length,
          missingTables: missingTables
        },
        tables: allTablesExist ? tableCounts : tableChecks,
        supabase: supabaseConfig
      },
      recommendations: allTablesExist ? 
        (Object.values(tableCounts).every(count => count === 0) ? 
          ['Run database migration to populate initial data', 'Visit /setup-database.html to initialize'] :
          ['Database is ready for use']) :
        ['Run database setup to create missing tables', 'Visit /setup-database.html for automatic setup'],
      api: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    })

  } catch (error) {
    console.error('❌ Supabase Health Check Error:', error)
    
    res.status(503).json({
      status: 'unhealthy',
      message: 'Supabase database health check failed',
      error: {
        message: error.message,
        code: error.code
      },
      timestamp: new Date().toISOString(),
      database: {
        type: 'Supabase PostgreSQL',
        connection: 'FAILED'
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    })
  }
}
