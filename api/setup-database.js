// api/setup-database.js - NAPRAWIONA WERSJA dla Supabase

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

    // ========== TWORZENIE TABEL PRZEZ SQL EDITOR ==========
    console.log('📊 Creating tables for Supabase using SQL...')

    // ZAMIAST RPC, użyjemy bezpośrednich operacji CREATE TABLE przez raw SQL
    // Supabase obsługuje to przez PostgREST

    // 1. Tabela companies
    console.log('📋 Creating companies table...')
    try {
      // Użyjemy funkcji wbudowanej w Supabase do wykonania SQL
      const { data, error } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
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
        `
      })
      
      if (error && !error.message.includes('already exists')) {
        throw error
      }
      results.tablesCreated.push('companies')
      console.log('✅ Companies table created')
    } catch (error) {
      // Jeśli RPC nie działa, spróbuj alternatywnej metody
      console.log('⚠️ SQL RPC failed, trying alternative method for companies...')
      results.errors.push(`companies: ${error.message}`)
    }

    // 2. Tabela drums
    console.log('🥁 Creating drums table...')
    try {
      const { data, error } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS drums (
            id SERIAL PRIMARY KEY,
            kod_bebna VARCHAR(255) UNIQUE NOT NULL,
            nazwa VARCHAR(255),
            cecha TEXT,
            data_zwrotu_do_dostawcy DATE,
            kon_dostawca TEXT,
            pelna_nazwa_kontrahenta TEXT,
            nip VARCHAR(20),
            typ_dok VARCHAR(50),
            nr_dokumentupz VARCHAR(100),
            data_przyjecia_na_stan DATE,
            kontrahent TEXT,
            status VARCHAR(20) DEFAULT 'Aktywny',
            data_wydania DATE,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `
      })
      
      if (error && !error.message.includes('already exists')) {
        throw error
      }
      results.tablesCreated.push('drums')
      console.log('✅ Drums table created')
    } catch (error) {
      console.log('⚠️ SQL RPC failed for drums...')
      results.errors.push(`drums: ${error.message}`)
    }

    // 3. Tabela admin_users
    console.log('👑 Creating admin_users table...')
    try {
      const { data, error } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
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
        `
      })
      
      if (error && !error.message.includes('already exists')) {
        throw error
      }
      results.tablesCreated.push('admin_users')
      console.log('✅ Admin_users table created')
    } catch (error) {
      console.log('⚠️ SQL RPC failed for admin_users...')
      results.errors.push(`admin_users: ${error.message}`)
    }

    // 4. Tabela users
    console.log('👤 Creating users table...')
    try {
      const { data, error } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            nip VARCHAR(20) UNIQUE NOT NULL,
            password_hash VARCHAR(255),
            is_first_login BOOLEAN DEFAULT TRUE,
            last_login TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            company VARCHAR(255)
          );
        `
      })
      
      if (error && !error.message.includes('already exists')) {
        throw error
      }
      results.tablesCreated.push('users')
      console.log('✅ Users table created')
    } catch (error) {
      console.log('⚠️ SQL RPC failed for users...')
      results.errors.push(`users: ${error.message}`)
    }

    // 5. Tabela return_requests
    console.log('📋 Creating return_requests table...')
    try {
      const { data, error } = await supabaseAdmin.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS return_requests (
            id SERIAL PRIMARY KEY,
            user_nip VARCHAR(20),
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
      })
      
      if (error && !error.message.includes('already exists')) {
        throw error
      }
      results.tablesCreated.push('return_requests')
      console.log('✅ Return_requests table created')
    } catch (error) {
      console.log('⚠️ SQL RPC failed for return_requests...')
      results.errors.push(`return_requests: ${error.message}`)
    }

    // ========== PLAN B: Jeśli SQL RPC nie działa, użyj SQL Editor instrukcji ==========
    if (results.tablesCreated.length === 0) {
      console.log('⚠️ SQL RPC not available, providing SQL instructions...')
      
      const sqlInstructions = `
-- WYKONAJ TE KOMENDY W SUPABASE SQL EDITOR:
-- (Supabase Dashboard → SQL Editor → New Query)

-- 1. Tabela companies
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

-- 2. Tabela drums
CREATE TABLE IF NOT EXISTS drums (
  id SERIAL PRIMARY KEY,
  kod_bebna VARCHAR(255) UNIQUE NOT NULL,
  nazwa VARCHAR(255),
  cecha TEXT,
  data_zwrotu_do_dostawcy DATE,
  kon_dostawca TEXT,
  pelna_nazwa_kontrahenta TEXT,
  nip VARCHAR(20),
  typ_dok VARCHAR(50),
  nr_dokumentupz VARCHAR(100),
  data_przyjecia_na_stan DATE,
  kontrahent TEXT,
  status VARCHAR(20) DEFAULT 'Aktywny',
  data_wydania DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela admin_users
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

-- 4. Tabela users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nip VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  is_first_login BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  company VARCHAR(255)
);

-- 5. Tabela return_requests
CREATE TABLE IF NOT EXISTS return_requests (
  id SERIAL PRIMARY KEY,
  user_nip VARCHAR(20),
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

-- 6. Dodaj administratorów
INSERT INTO admin_users (nip, username, name, email, role, is_active) VALUES
('0000000000', 'admin', 'Administrator Systemu', 'admin@grupaeltron.pl', 'admin', true),
('1111111111', 'supervisor', 'Supervisor', 'supervisor@grupaeltron.pl', 'supervisor', true)
ON CONFLICT (nip) DO NOTHING;
      `
      
      return res.status(200).json({
        success: false,
        message: 'SQL RPC not available - manual setup required',
        sqlInstructions: sqlInstructions,
        instructions: [
          '1. Otwórz Supabase Dashboard → SQL Editor',
          '2. Utwórz nowe zapytanie (New Query)',
          '3. Wklej i wykonaj SQL z pola "sqlInstructions"',
          '4. Sprawdź czy tabele zostały utworzone',
          '5. Uruchom ponownie /api/health aby sprawdzić status'
        ],
        results: results
      })
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

    console.log('✅ Database setup completed!')

    res.status(200).json({
      success: true,
      message: 'Database setup completed successfully!',
      results: results,
      nextSteps: [
        '1. Check /api/health to verify tables were created',
        '2. Set passwords for admin accounts using /api/auth/register',
        '3. Add company data and drums using /api/migrate',
        '4. Test the system!'
      ],
      adminAccounts: adminUsers.map(admin => ({
        username: admin.username,
        nip: admin.nip,
        role: admin.role,
        note: 'Password not set - use /api/auth/register to set password'
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
