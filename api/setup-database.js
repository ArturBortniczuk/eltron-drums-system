// api/setup-database.js - Automatyczne tworzenie tabel i setup bazy dla Supabase
const { sql } = require('@vercel/postgres');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed. Use POST to setup database.',
      usage: 'POST /api/setup-database with { "key": "setup-eltron-2024" }'
    });
  }

  try {
    const { key } = req.body;

    // Autoryzacja
    if (key !== 'setup-eltron-2024') {
      return res.status(401).json({ error: 'Invalid setup key' });
    }

    console.log('🚀 Starting database setup for Supabase...');

    // Test połączenia z Supabase
    try {
      await sql`SELECT 1 as test`;
      console.log('✅ Supabase database connection successful');
    } catch (error) {
      return res.status(500).json({
        error: 'Supabase database connection failed',
        details: error.message,
        suggestion: 'Check POSTGRES_URL environment variable and Supabase configuration'
      });
    }

    const results = {
      tablesCreated: [],
      tablesSkipped: [],
      adminsCreated: 0,
      errors: []
    };

    // ========== TWORZENIE TABEL ==========
    console.log('📊 Creating tables for Supabase...');

    // 1. Tabela companies
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS companies (
          id SERIAL PRIMARY KEY,
          nip VARCHAR(20) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(50),
          address TEXT,
          status VARCHAR(50) DEFAULT 'Aktywny',
          last_activity TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.tablesCreated.push('companies');
      console.log('✅ Table companies created');
    } catch (error) {
      results.errors.push(`companies: ${error.message}`);
      console.warn('⚠️ Error creating companies table:', error.message);
    }

    // 2. Tabela drums
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS drums (
          id SERIAL PRIMARY KEY,
          kod_bebna VARCHAR(255) UNIQUE NOT NULL,
          nazwa VARCHAR(255),
          cecha TEXT,
          data_zwrotu_do_dostawcy DATE,
          kon_dostawca TEXT,
          pelna_nazwa_kontrahenta TEXT,
          nip VARCHAR(20) REFERENCES companies(nip),
          typ_dok VARCHAR(50),
          nr_dokumentupz VARCHAR(100),
          data_przyjecia_na_stan DATE,
          kontrahent TEXT,
          status VARCHAR(20) DEFAULT 'Aktywny',
          data_wydania DATE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.tablesCreated.push('drums');
      console.log('✅ Table drums created');
    } catch (error) {
      results.errors.push(`drums: ${error.message}`);
      console.warn('⚠️ Error creating drums table:', error.message);
    }

    // 3. Tabela users
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          nip VARCHAR(20) UNIQUE NOT NULL REFERENCES companies(nip),
          password_hash VARCHAR(255) NOT NULL,
          is_first_login BOOLEAN DEFAULT TRUE,
          last_login TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          company VARCHAR(255)
        )
      `;
      results.tablesCreated.push('users');
      console.log('✅ Table users created');
    } catch (error) {
      results.errors.push(`users: ${error.message}`);
      console.warn('⚠️ Error creating users table:', error.message);
    }

    // 4. Tabela return_requests
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS return_requests (
          id SERIAL PRIMARY KEY,
          user_nip VARCHAR(20) REFERENCES companies(nip),
          company_name TEXT NOT NULL,
          street TEXT NOT NULL,
          postal_code VARCHAR(10) NOT NULL,
          city VARCHAR(100) NOT NULL,
          email VARCHAR(255) NOT NULL,
          loading_hours VARCHAR(50) NOT NULL,
          available_equipment TEXT,
          notes TEXT,
          collection_date DATE NOT NULL,
          selected_drums JSONB NOT NULL,
          status VARCHAR(20) DEFAULT 'Pending',
          priority VARCHAR(10) DEFAULT 'Normal',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.tablesCreated.push('return_requests');
      console.log('✅ Table return_requests created');
    } catch (error) {
      results.errors.push(`return_requests: ${error.message}`);
      console.warn('⚠️ Error creating return_requests table:', error.message);
    }

    // 5. Tabela custom_return_periods
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS custom_return_periods (
          id SERIAL PRIMARY KEY,
          nip VARCHAR(20) UNIQUE REFERENCES companies(nip),
          return_period_days INTEGER NOT NULL DEFAULT 85,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.tablesCreated.push('custom_return_periods');
      console.log('✅ Table custom_return_periods created');
    } catch (error) {
      results.errors.push(`custom_return_periods: ${error.message}`);
      console.warn('⚠️ Error creating custom_return_periods table:', error.message);
    }

    // 6. Tabela admin_users
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS admin_users (
          id SERIAL PRIMARY KEY,
          nip VARCHAR(10) UNIQUE NOT NULL,
          username VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) NOT NULL,
          role VARCHAR(20) DEFAULT 'admin',
          permissions JSONB,
          password_hash TEXT,
          is_active BOOLEAN DEFAULT true,
          last_login TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      results.tablesCreated.push('admin_users');
      console.log('✅ Table admin_users created');
    } catch (error) {
      results.errors.push(`admin_users: ${error.message}`);
      console.warn('⚠️ Error creating admin_users table:', error.message);
    }

    // ========== DODAWANIE ADMINISTRATORÓW ==========
    console.log('👥 Adding admin users...');

    const admins = [
      {
        nip: '0000000000',
        username: 'admin',
        name: 'Administrator Systemu',
        email: 'admin@grupaeltron.pl',
        role: 'admin',
        permissions: { all: true }
      },
      {
        nip: '1111111111',
        username: 'supervisor',
        name: 'Supervisor',
        email: 'supervisor@grupaeltron.pl',
        role: 'supervisor',
        permissions: { view: true, edit: true, manage_clients: true }
      }
    ];

    for (const admin of admins) {
      try {
        const result = await sql`
          INSERT INTO admin_users (nip, username, name, email, role, permissions, is_active)
          VALUES (
            ${admin.nip},
            ${admin.username},
            ${admin.name},
            ${admin.email},
            ${admin.role},
            ${JSON.stringify(admin.permissions)},
            true
          )
          ON CONFLICT (nip) DO UPDATE SET
            username = EXCLUDED.username,
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            permissions = EXCLUDED.permissions
          RETURNING id
        `;
        
        results.adminsCreated++;
        console.log(`✅ Admin user ${admin.username} created/updated`);
        
      } catch (error) {
        results.errors.push(`admin ${admin.username}: ${error.message}`);
        console.warn(`⚠️ Error creating admin ${admin.username}:`, error.message);
      }
    }

    // ========== SPRAWDZENIE FINALNEGO STANU ==========
    console.log('🔍 Checking final database state...');

    const verification = {};
    try {
      // Sprawdź każdą tabelę
      for (const tableName of ['companies', 'drums', 'users', 'return_requests', 'custom_return_periods', 'admin_users']) {
        try {
          const result = await sql`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = ${tableName}
          `;
          verification[tableName] = {
            exists: result.rows[0].count > 0,
            status: result.rows[0].count > 0 ? 'OK' : 'MISSING'
          };
        } catch (error) {
          verification[tableName] = {
            exists: false,
            status: 'ERROR',
            error: error.message
          };
        }
      }

      // Sprawdź liczbę adminów
      const adminCount = await sql`SELECT COUNT(*) as count FROM admin_users`;
      verification.admin_count = parseInt(adminCount.rows[0].count);

    } catch (error) {
      console.warn('⚠️ Error during verification:', error.message);
    }

    console.log('🎉 Supabase database setup completed!');

    return res.status(200).json({
      success: true,
      message: '🎉 Supabase database setup completed successfully!',
      database: 'Supabase PostgreSQL',
      results: {
        tablesCreated: results.tablesCreated,
        tablesSkipped: results.tablesSkipped,
        adminsCreated: results.adminsCreated,
        errorsCount: results.errors.length,
        errors: results.errors
      },
      verification: verification,
      nextSteps: [
        '1. Check /api/health to verify everything works',
        '2. Use /api/migrate to import your drums data',
        '3. Test login with admin accounts (NIP: 0000000000 or 1111111111)',
        '4. Configure RLS policies in Supabase if needed',
        '5. Start using the system!'
      ],
      testAccounts: [
        { type: 'Admin', nip: '0000000000', note: 'Set password on first login' },
        { type: 'Supervisor', nip: '1111111111', note: 'Set password on first login' }
      ],
      supabaseInfo: {
        url: process.env.SUPABASE_URL,
        pooling: process.env.POSTGRES_URL?.includes('pooler') ? 'enabled' : 'disabled'
      }
    });

  } catch (error) {
    console.error('❌ Supabase database setup failed:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Supabase database setup failed',
      details: error.message,
      timestamp: new Date().toISOString(),
      suggestion: 'Check Supabase connection and environment variables',
      environmentCheck: {
        POSTGRES_URL: !!process.env.POSTGRES_URL,
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_JWT_SECRET: !!process.env.SUPABASE_JWT_SECRET
      }
    });
  }
};