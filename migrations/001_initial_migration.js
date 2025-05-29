// migrations/001_initial_migration.js
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

// Import danych z mockData
import { mockDrumsData } from '../src/data/mockData.js';
import { mockCompanies, mockReturnRequests, mockAdmins, mockCustomReturnPeriods } from '../src/data/additionalData.js';

export async function createTables() {
  console.log('Creating database tables...');
  
  try {
    // Tabela companies (firmy)
    await sql`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        nip VARCHAR(10) UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        address TEXT,
        status VARCHAR(20) DEFAULT 'Aktywny',
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Tabela drums (bębny)
    await sql`
      CREATE TABLE IF NOT EXISTS drums (
        id SERIAL PRIMARY KEY,
        kod_bebna VARCHAR(50) UNIQUE NOT NULL,
        nazwa TEXT NOT NULL,
        cecha TEXT,
        data_zwrotu_do_dostawcy DATE,
        kon_dostawca TEXT,
        nip VARCHAR(10) REFERENCES companies(nip),
        typ_dok VARCHAR(50),
        nr_dokumentupz VARCHAR(100),
        data_przyjecia_na_stan DATE,
        kontrahent TEXT,
        status VARCHAR(20) DEFAULT 'Aktywny',
        data_wydania DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Tabela users (hasła użytkowników)
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nip VARCHAR(10) UNIQUE NOT NULL REFERENCES companies(nip),
        password_hash TEXT NOT NULL,
        is_first_login BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Tabela return_requests (zgłoszenia zwrotów)
    await sql`
      CREATE TABLE IF NOT EXISTS return_requests (
        id SERIAL PRIMARY KEY,
        user_nip VARCHAR(10) REFERENCES companies(nip),
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Tabela custom_return_periods (niestandardowe terminy)
    await sql`
      CREATE TABLE IF NOT EXISTS custom_return_periods (
        id SERIAL PRIMARY KEY,
        nip VARCHAR(10) UNIQUE REFERENCES companies(nip),
        return_period_days INTEGER NOT NULL DEFAULT 85,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Tabela admin_users (administratorzy)
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
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('✅ Tables created successfully');
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  }
}

export async function seedData() {
  console.log('Seeding database with mock data...');
  
  try {
    // 1. Wstaw firmy (companies)
    console.log('Inserting companies...');
    
    // Wyciągnij unikalne firmy z mockDrumsData
    const uniqueCompanies = new Map();
    
    mockDrumsData.forEach(drum => {
      if (!uniqueCompanies.has(drum.NIP)) {
        uniqueCompanies.set(drum.NIP, {
          nip: drum.NIP,
          name: drum.PELNA_NAZWA_KONTRAHENTA || drum.KONTRAHENT || 'Nieznana firma'
        });
      }
    });

    // Dodaj firmy z mockCompanies (jeśli istnieją)
    if (mockCompanies) {
      mockCompanies.forEach(company => {
        uniqueCompanies.set(company.nip, {
          nip: company.nip,
          name: company.name,
          email: company.email,
          phone: company.phone,
          address: company.address,
          status: company.status || 'Aktywny'
        });
      });
    }

    // Wstaw firmy do bazy
    for (const [nip, company] of uniqueCompanies) {
      await sql`
        INSERT INTO companies (nip, name, email, phone, address, status, last_activity)
        VALUES (
          ${company.nip},
          ${company.name},
          ${company.email || null},
          ${company.phone || null},
          ${company.address || null},
          ${company.status || 'Aktywny'},
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (nip) DO UPDATE SET
          name = EXCLUDED.name,
          email = COALESCE(EXCLUDED.email, companies.email),
          phone = COALESCE(EXCLUDED.phone, companies.phone),
          address = COALESCE(EXCLUDED.address, companies.address)
      `;
    }

    console.log(`✅ Inserted ${uniqueCompanies.size} companies`);

    // 2. Wstaw bębny (drums)
    console.log('Inserting drums...');
    
    for (const drum of mockDrumsData) {
      await sql`
        INSERT INTO drums (
          kod_bebna, nazwa, cecha, data_zwrotu_do_dostawcy, kon_dostawca,
          nip, typ_dok, nr_dokumentupz, data_przyjecia_na_stan,
          kontrahent, status, data_wydania
        ) VALUES (
          ${drum.KOD_BEBNA},
          ${drum.NAZWA},
          ${drum.CECHA || null},
          ${drum.DATA_ZWROTU_DO_DOSTAWCY},
          ${drum.KON_DOSTAWCA || null},
          ${drum.NIP},
          ${drum.TYP_DOK || null},
          ${drum.NR_DOKUMENTUPZ || null},
          ${drum['Data przyjęcia na stan'] || null},
          ${drum.KONTRAHENT || null},
          ${drum.STATUS || 'Aktywny'},
          ${drum.DATA_WYDANIA || null}
        )
        ON CONFLICT (kod_bebna) DO UPDATE SET
          nazwa = EXCLUDED.nazwa,
          cecha = EXCLUDED.cecha,
          data_zwrotu_do_dostawcy = EXCLUDED.data_zwrotu_do_dostawcy
      `;
    }

    console.log(`✅ Inserted ${mockDrumsData.length} drums`);

    // 3. Wstaw administratorów
    console.log('Inserting admin users...');
    
    const defaultAdmins = mockAdmins || [
      {
        id: 1,
        nip: '0000000000',
        username: 'admin',
        name: 'Administrator Systemu',
        email: 'admin@grupaeltron.pl',
        role: 'admin',
        permissions: { all: true }
      },
      {
        id: 2,
        nip: '1111111111',
        username: 'supervisor',
        name: 'Supervisor',
        email: 'supervisor@grupaeltron.pl',
        role: 'supervisor',
        permissions: { view: true, edit: true }
      }
    ];

    for (const admin of defaultAdmins) {
      await sql`
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
      `;
    }

    console.log(`✅ Inserted ${defaultAdmins.length} admin users`);

    // 4. Wstaw niestandardowe terminy zwrotu (jeśli istnieją)
    if (mockCustomReturnPeriods && mockCustomReturnPeriods.length > 0) {
      console.log('Inserting custom return periods...');
      
      for (const period of mockCustomReturnPeriods) {
        await sql`
          INSERT INTO custom_return_periods (nip, return_period_days)
          VALUES (${period.nip}, ${period.returnPeriodDays})
          ON CONFLICT (nip) DO UPDATE SET
            return_period_days = EXCLUDED.return_period_days,
            updated_at = CURRENT_TIMESTAMP
        `;
      }

      console.log(`✅ Inserted ${mockCustomReturnPeriods.length} custom return periods`);
    }

    // 5. Wstaw przykładowe zgłoszenia zwrotów (jeśli istnieją)
    if (mockReturnRequests && mockReturnRequests.length > 0) {
      console.log('Inserting return requests...');
      
      for (const request of mockReturnRequests) {
        await sql`
          INSERT INTO return_requests (
            user_nip, company_name, street, postal_code, city,
            email, loading_hours, available_equipment, notes,
            collection_date, selected_drums, status, priority
          ) VALUES (
            ${request.user_nip},
            ${request.company_name},
            ${request.street || 'ul. Przykładowa 1'},
            ${request.postal_code || '00-000'},
            ${request.city || 'Warszawa'},
            ${request.email},
            ${request.loading_hours || '8:00-16:00'},
            ${request.available_equipment || null},
            ${request.notes || null},
            ${request.collection_date},
            ${JSON.stringify(request.selected_drums)},
            ${request.status || 'Pending'},
            ${request.priority || 'Normal'}
          )
          ON CONFLICT DO NOTHING
        `;
      }

      console.log(`✅ Inserted ${mockReturnRequests.length} return requests`);
    }

    console.log('🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  }
}

// Funkcja główna migracji
export async function runMigration() {
  console.log('🚀 Starting database migration...');
  
  try {
    await createTables();
    await seedData();
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Uruchom migrację jeśli plik jest wykonywany bezpośrednio
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}