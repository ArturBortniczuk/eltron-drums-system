import { supabaseAdmin } from '../utils/supabase/server.js'

export default async function handler(req, res) {
  try {
    console.log('🏥 Starting Supabase health check...')
    
    // 1. Test podstawowego połączenia - sprawdź czy jedna z tabel istnieje
    let connectionOK = false
    try {
      const { data, error } = await supabaseAdmin
        .from('companies')
        .select('id')
        .limit(1)
      
      connectionOK = true // Jeśli nie ma błędu, połączenie działa
      console.log('✅ Basic connection test passed')
    } catch (error) {
      console.log('⚠️ Companies table might not exist, trying alternative test...')
      
      // Alternatywny test - sprawdź czy możemy wykonać jakiekolwiek zapytanie
      try {
        const { data, error } = await supabaseAdmin.rpc('version')
        connectionOK = !error
      } catch (altError) {
        throw new Error(`Connection failed: ${error.message}`)
      }
    }
    
    // 2. Sprawdź czy istnieją kluczowe tabele (poprzez próbę query)
    const requiredTables = ['companies', 'drums', 'users', 'admin_users', 'return_requests']
    const tableChecks = {}
    
    for (const tableName of requiredTables) {
      try {
        const { data, error } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .limit(1)
        
        tableChecks[tableName] = !error
        if (error) {
          console.log(`⚠️ Table ${tableName} check failed: ${error.message}`)
        } else {
          console.log(`✅ Table ${tableName} exists`)
        }
      } catch (error) {
        tableChecks[tableName] = false
        console.warn(`⚠️ Error checking table ${tableName}:`, error.message)
      }
    }

    // 3. Sprawdź czy wszystkie wymagane tabele istnieją
    const missingTables = requiredTables.filter(table => !tableChecks[table])
    const allTablesExist = missingTables.length === 0

    // 4. Sprawdź liczbę rekordów w kluczowych tabelach (tylko jeśli tabele istnieją)
    const tableCounts = {}
    if (allTablesExist) {
      for (const tableName of requiredTables) {
        try {
          const { count, error } = await supabaseAdmin
            .from(tableName)
            .select('*', { count: 'exact', head: true })
          
          tableCounts[tableName] = error ? 0 : count
          console.log(`📊 Table ${tableName}: ${tableCounts[tableName]} records`)
        } catch (error) {
          tableCounts[tableName] = 0
          console.warn(`⚠️ Error counting ${tableName}:`, error.message)
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
    
    if (!connectionOK) {
      overallStatus = 'unhealthy'
      statusMessage = 'Cannot connect to Supabase database'
    } else if (!allTablesExist) {
      overallStatus = 'degraded'
      statusMessage = `Database schema incomplete. Missing tables: ${missingTables.join(', ')}`
    } else if (Object.values(tableCounts).every(count => count === 0)) {
      overallStatus = 'warning'
      statusMessage = 'Database schema exists but no data found. Run setup/migration.'
    }

    console.log(`🏥 Health check completed with status: ${overallStatus}`)

    const responseCode = overallStatus === 'healthy' ? 200 : 
                        overallStatus === 'warning' ? 200 : 503

    res.status(responseCode).json({
      status: overallStatus,
      message: statusMessage,
      timestamp: new Date().toISOString(),
      database: {
        type: 'Supabase PostgreSQL',
        connection: connectionOK ? 'OK' : 'FAILED',
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
        code: error.code || 'UNKNOWN'
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
      },
      nextSteps: [
        'Check if tables exist by running setup-database',
        'Verify Supabase project is active',
        'Check environment variables are correct',
        'Try running /api/setup-database first'
      ]
    })
  }
}
