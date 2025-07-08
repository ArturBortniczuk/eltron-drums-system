// api/health.js - Health check dla Supabase

import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    console.log('🏥 Starting Supabase health check...');
    
    // 1. Test podstawowego połączenia
    const connectionTest = await sql`SELECT 1 as test, NOW() as timestamp`;
    console.log('✅ Basic connection test passed');
    
    // 2. Sprawdź czy istnieją kluczowe tabele
    const tableChecks = {};
    const requiredTables = ['companies', 'drums', 'users', 'admin_users', 'return_requests', 'custom_return_periods'];
    
    for (const tableName of requiredTables) {
      try {
        const tableExists = await sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = ${tableName}
          ) as exists
        `;
        tableChecks[tableName] = tableExists.rows[0].exists;
      } catch (error) {
        tableChecks[tableName] = false;
        console.warn(`⚠️ Error checking table ${tableName}:`, error.message);
      }
    }

    // 3. Sprawdź czy wszystkie wymagane tabele istnieją
    const missingTables = requiredTables.filter(table => !tableChecks[table]);
    const allTablesExist = missingTables.length === 0;

    // 4. Sprawdź liczbę rekordów w kluczowych tabelach (jeśli istnieją)
    const tableCounts = {};
    if (allTablesExist) {
      try {
        // Policz rekordy w każdej tabeli
        for (const tableName of requiredTables) {
          try {
            const countResult = await sql.unsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
            tableCounts[tableName] = parseInt(countResult.rows[0].count);
          } catch (error) {
            tableCounts[tableName] = 0;
            console.warn(`⚠️ Error counting records in ${tableName}:`, error.message);
          }
        }
      } catch (error) {
        console.warn('⚠️ Error getting table counts:', error.message);
      }
    }

    // 5. Sprawdź konfigurację Supabase
    const supabaseConfig = {
      url: process.env.SUPABASE_URL ? 'configured' : 'missing',
      jwtSecret: process.env.SUPABASE_JWT_SECRET ? 'configured' : 'missing',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'configured' : 'missing',
      postgresUrl: process.env.POSTGRES_URL ? 'configured' : 'missing',
      poolingEnabled: process.env.POSTGRES_URL?.includes('pooler') || false
    };

    // 6. Określ ogólny status
    let overallStatus = 'healthy';
    let statusMessage = 'Supabase database is fully operational';
    
    if (!allTablesExist) {
      overallStatus = 'degraded';
      statusMessage = `Database schema incomplete. Missing tables: ${missingTables.join(', ')}`;
    } else if (Object.values(tableCounts).every(count => count === 0)) {
      overallStatus = 'warning';
      statusMessage = 'Database schema exists but no data found. Run setup/migration.';
    }

    console.log(`🏥 Health check completed with status: ${overallStatus}`);

    // Zwróć szczegółowy raport
    res.status(overallStatus === 'healthy' ? 200 : overallStatus === 'warning' ? 200 : 503).json({
      status: overallStatus,
      message: statusMessage,
      timestamp: new Date().toISOString(),
      database: {
        type: 'Supabase PostgreSQL',
        connection: 'OK',
        timestamp: connectionTest.rows[0].timestamp,
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
    });

  } catch (error) {
    console.error('❌ Supabase Health Check Error:', error);
    
    // Szczegółowa analiza błędu
    let errorType = 'unknown';
    let suggestion = 'Check Supabase configuration';
    
    if (error.message.includes('connection')) {
      errorType = 'connection';
      suggestion = 'Verify POSTGRES_URL and network connectivity to Supabase';
    } else if (error.message.includes('authentication')) {
      errorType = 'authentication';
      suggestion = 'Check database credentials and Supabase project settings';
    } else if (error.message.includes('timeout')) {
      errorType = 'timeout';
      suggestion = 'Database query timeout - check Supabase performance';
    }

    res.status(503).json({
      status: 'unhealthy',
      message: 'Supabase database health check failed',
      error: {
        type: errorType,
        message: error.message,
        code: error.code,
        suggestion: suggestion
      },
      timestamp: new Date().toISOString(),
      database: {
        type: 'Supabase PostgreSQL',
        connection: 'FAILED'
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        hasPostgresUrl: !!process.env.POSTGRES_URL,
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseSecret: !!process.env.SUPABASE_JWT_SECRET
      },
      nextSteps: [
        'Check Supabase project status at https://supabase.com/dashboard',
        'Verify all environment variables are set correctly',
        'Check Vercel deployment logs for more details',
        'Test database connection manually'
      ]
    });
  }
}