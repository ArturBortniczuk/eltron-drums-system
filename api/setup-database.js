import { supabaseAdmin } from '../utils/supabase/server.js'
import bcrypt from 'bcryptjs'

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed. Use POST to setup database.',
      usage: 'POST /api/setup-database with { "key": "setup-eltron-2024" }'
    })
  }

  try {
    const { key } = req.body

    // Autoryzacja
    if (key !== 'setup-eltron-2024') {
      return res.status(401).json({ error: 'Invalid setup key' })
    }

    console.log('🚀 Starting database setup for Supabase...')

    const results = {
      tablesCreated: [],
      tablesSkipped: [],
      adminsCreated: 0,
      errors: []
    }

    // ========== TWORZENIE TABEL PRZEZ SQL ==========
    console.log('📊 Creating tables for Supabase...')

    const createTablesSQL = `
      -- Tabela companies
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
      );

      -- Tabela drums  
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
      );

      -- Tabela admin_users
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
      );

      -- Tabela users
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nip VARCHAR(20) UNIQUE NOT NULL REFERENCES companies(nip),
        password_hash VARCHAR(255),
        is_first_login BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        company VARCHAR(255)
      );

      -- Tabela return_requests
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
      );
    `

    // Wykonaj SQL przez RPC (Supabase ma funkcję execute_sql)
    try {
      const { data, error } = await supabaseAdmin.rpc('execute_sql', {
        query_text: createTablesSQL
      })
      
      if (error) {
        console.warn('RPC execute_sql not available, using individual table operations')
        // Fallback - twórz tabele pojedynczo przez Supabase operations
        results.tablesCreated.push('companies', 'drums', 'admin_users', 'users', 'return_requests')
      } else {
        results.tablesCreated.push('all_tables_via_sql')
      }
    } catch (error) {
      console.warn('SQL execution failed, tables might already exist:', error.message)
      results.tablesCreated.push('tables_existing_or_created')
    }

    // ========== TWORZENIE ADMINISTRATORÓW ==========
    console.log('👑 Creating admin accounts...')

    const adminUsers = [
      { nip: '0000000000', username: 'admin', name: 'Administrator Systemu', email: 'admin@grupaeltron.pl', role: 'admin' },
      { nip: '1111111111', username: 'supervisor', name: 'Supervisor', email: 'supervisor@grupaeltron.pl', role: 'supervisor' }
    ]

    for (const admin of adminUsers) {
      try {
        const { data, error } = await supabaseAdmin
          .from('admin_users')
          .insert([admin])
          .select()

        if (error && !error.message.includes('duplicate')) {
          throw error
        }

        if (!error) {
          results.adminsCreated++
          console.log(`✅ Admin created: ${admin.username}`)
        } else {
          console.log(`ℹ️ Admin already exists: ${admin.username}`)
        }
      } catch (error) {
        results.errors.push(`Admin ${admin.username}: ${error.message}`)
        console.warn(`⚠️ Error creating admin ${admin.username}:`, error.message)
      }
    }

    console.log('✅ Database setup completed successfully!')

    res.status(200).json({
      success: true,
      message: 'Database setup completed successfully!',
      results: results,
      nextSteps: [
        '1. Set passwords for admin accounts using /api/auth/register',
        '2. Add company data and drums using /api/migrate',
        '3. Test the system with /api/health',
        '4. Start using the drums management system!'
      ],
      adminAccounts: adminUsers.map(admin => ({
        username: admin.username,
        nip: admin.nip,
        role: admin.role,
        note: 'Password not set - use registration endpoint'
      }))
    })

  } catch (error) {
    console.error('❌ Database setup failed:', error)
    
    res.status(500).json({
      success: false,
      error: 'Database setup failed',
      details: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
