// api/health.js - ZAKTUALIZOWANY
const { sql } = require('@vercel/postgres');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Test połączenia i pobierz szczegółowe statystyki
    const [companiesResult, drumsResult, adminsResult, usersResult] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM companies`,
      sql`SELECT COUNT(*) as count FROM drums`,
      sql`SELECT COUNT(*) as count FROM admin_users`,
      sql`SELECT COUNT(*) as count FROM users`
    ]);

    // Statystyki bębnów według statusów
    const [activeDrums, overdueDrums] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM drums WHERE status = 'Aktywny'`,
      sql`SELECT COUNT(*) as count FROM drums WHERE data_zwrotu_do_dostawcy < CURRENT_DATE`
    ]);

    // Przykładowe dane
    const [sampleCompany, sampleDrum, recentDrums] = await Promise.all([
      sql`SELECT name, nip FROM companies ORDER BY created_at DESC LIMIT 1`,
      sql`SELECT kod_bebna, nazwa, nip, data_zwrotu_do_dostawcy FROM drums ORDER BY created_at DESC LIMIT 1`,
      sql`SELECT kod_bebna, nazwa, pelna_nazwa_kontrahenta FROM drums ORDER BY created_at DESC LIMIT 5`
    ]);

    // Statystyki firm
    const topCompanies = await sql`
      SELECT c.name, c.nip, COUNT(d.id) as drums_count 
      FROM companies c 
      LEFT JOIN drums d ON c.nip = d.nip 
      GROUP BY c.nip, c.name 
      ORDER BY drums_count DESC 
      LIMIT 5
    `;

    const stats = {
      companies: parseInt(companiesResult.rows[0].count),
      drums: parseInt(drumsResult.rows[0].count),
      admin_users: parseInt(adminsResult.rows[0].count),
      client_users: parseInt(usersResult.rows[0].count),
      active_drums: parseInt(activeDrums.rows[0].count),
      overdue_drums: parseInt(overdueDrums.rows[0].count)
    };

    // Sprawdź czy baza wydaje się być w pełni zmigrowana
    const isFullyMigrated = stats.drums > 1000 && stats.companies > 10;

    return res.status(200).json({
      status: 'healthy',
      database: {
        connected: true,
        migration_status: isFullyMigrated ? 'complete' : 'partial_or_test_data',
        tables: stats,
        health_indicators: {
          has_companies: stats.companies > 0,
          has_drums: stats.drums > 0,
          has_admin_users: stats.admin_users > 0,
          realistic_data_volume: stats.drums > 100
        }
      },
      samples: {
        latest_company: sampleCompany.rows[0] || null,
        latest_drum: sampleDrum.rows[0] || null,
        recent_drums: recentDrums.rows || []
      },
      analytics: {
        top_companies_by_drums: topCompanies.rows || [],
        drums_health: {
          total: stats.drums,
          active: stats.active_drums,
          overdue: stats.overdue_drums,
          overdue_percentage: stats.drums > 0 ? Math.round((stats.overdue_drums / stats.drums) * 100) : 0
        }
      },
      timestamp: new Date().toISOString(),
      message: isFullyMigrated 
        ? '🎉 System is fully operational with real data!' 
        : '⚠️ System operational but may need full data migration',
      api_endpoints: {
        auth: '/api/auth/login',
        drums: '/api/drums',
        companies: '/api/companies',
        returns: '/api/returns',
        migration: '/api/migrate'
      },
      next_steps: isFullyMigrated ? [
        'System is ready to use!',
        'Login with any NIP from your data',
        'Set password on first login',
        'Start managing drums and returns'
      ] : [
        'Run full data migration at /api/migrate',
        'Provide real drums data from mockData.js',
        'Test login functionality',
        'Verify data completeness'
      ]
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    // Try to determine what type of error this is
    let errorType = 'unknown';
    let suggestion = 'Check database configuration';
    
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      errorType = 'missing_tables';
      suggestion = 'Run database migration at POST /api/migrate';
    } else if (error.message.includes('connection')) {
      errorType = 'connection_error';
      suggestion = 'Check DATABASE_URL environment variable';
    }

    return res.status(500).json({
      status: 'unhealthy',
      error: {
        type: errorType,
        message: error.message,
        suggestion: suggestion
      },
      timestamp: new Date().toISOString(),
      debug_info: {
        environment: process.env.NODE_ENV || 'unknown',
        has_database_url: !!process.env.DATABASE_URL,
        vercel_region: process.env.VERCEL_REGION || 'unknown'
      }
    });
  }
};
