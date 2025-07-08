// api/setup-database.js - Automatyczne tworzenie tabel i setup bazy dla Supabase
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
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
          kod_bebna VARCHAR(100) UNIQUE NOT NULL,
          nazwa VARCHAR(255) NOT NULL,
          cecha VARCHAR(255),
          data_zwrotu_do_dostawcy DATE,
          kon_dostawca VARCHAR(255),
          pelna_nazwa_kontrahenta VARCHAR(500),
          nip VARCHAR(20) REFERENCES companies(nip),
          typ_dok VARCHAR(100),
          nr_dokumentupz VARCHAR(100),
          data_przyjecia_na_stan DATE,
          kontrahent VARCHAR(255),
          status VARCHAR(50) DEFAULT 'Aktywny',
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

    // 3. Tabela admin_users
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS admin_users (
          id SERIAL PRIMARY KEY,
          nip VARCHAR(20) UNIQUE NOT NULL,
          username VARCHAR(100) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'admin',
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

    // 4. Tabela users
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          nip VARCHAR(20) UNIQUE NOT NULL REFERENCES companies(nip),
          password_hash VARCHAR(255) NOT NULL,
          is_first_login BOOLEAN DEFAULT TRUE,
          last_login TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          company VARCHAR(500)
        )
      `;
      results.tablesCreated.push('users');
      console.log('✅ Table users created');
    } catch (error) {
      results.errors.push(`users: ${error.message}`);
      console.warn('⚠️ Error creating users table:', error.message);
    }

    // 5. Tabela return_requests
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

    // 6. Tabela custom_return_periods
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

    // ========== TWORZENIE DOMYŚLNYCH ADMINISTRATORÓW ==========
    console.log('👨‍💼 Creating default administrators...');

    const adminUsers = [
      {
        nip: '0000000000',
        username: 'admin',
        name: 'Administrator Systemu',
        email: 'admin@grupaeltron.pl',
        password: 'admin123',
        role: 'admin'
      },
      {
        nip: '1111111111',
        username: 'supervisor',
        name: 'Supervisor',
        email: 'supervisor@grupaeltron.pl',
        password: 'super123',
        role: 'admin'
      }
    ];

    for (const admin of adminUsers) {
      try {
        // Sprawdź czy admin już istnieje
        const { rows: existingAdmin } = await sql`
          SELECT id FROM admin_users WHERE nip = ${admin.nip} OR username = ${admin.username}
        `;

        if (existingAdmin.length === 0) {
          const hashedPassword = await bcrypt.hash(admin.password, 10);
          await sql`
            INSERT INTO admin_users (nip, username, name, email, role, password_hash, permissions)
            VALUES (${admin.nip}, ${admin.username}, ${admin.name}, ${admin.email}, ${admin.role}, ${hashedPassword}, '{}')
          `;
          results.adminsCreated++;
          console.log(`✅ Created admin: ${admin.username}`);
        } else {
          console.log(`⚠️ Admin ${admin.username} already exists, skipping`);
        }
      } catch (error) {
        results.errors.push(`admin_${admin.username}: ${error.message}`);
        console.warn(`⚠️ Error creating admin ${admin.username}:`, error.message);
      }
    }

    // ========== WYNIKI ==========
    console.log('🎉 Database setup completed!');

    const response = {
      success: true,
      message: 'Database setup completed successfully',
      results: {
        tablesCreated: results.tablesCreated,
        adminsCreated: results.adminsCreated,
        errors: results.errors,
        totalTables: results.tablesCreated.length,
        hasErrors: results.errors.length > 0
      },
      next_steps: [
        'Use /api/health to verify database status',
        'Import your data using migration scripts',
        'Login with admin credentials: admin/admin123 or supervisor/super123',
        'Set up client accounts for your companies'
      ],
      admin_accounts: [
        { nip: '0000000000', username: 'admin', password: 'admin123' },
        { nip: '1111111111', username: 'supervisor', password: 'super123' }
      ]
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Database setup failed',
      message: error.message,
      stack: error.stack,
      suggestion: 'Check environment variables and database connection'
    });
  }
}
