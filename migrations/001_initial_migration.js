// migrations/001_initial_migration.js - ZAKTUALIZOWANA WERSJA
const { sql } = require('@vercel/postgres');

// Import realnych danych - UWAGA: Będzie potrzebny w środowisku Node.js
// Dla Vercel API możemy też przekazać dane jako parametr

async function createTables() {
  console.log('Creating database tables...');
  
  try {
    // Tabela companies (firmy) - struktura zgodna z mockData.js
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

    // Tabela drums (bębny) - wszystkie kolumny z mockData.js
    await sql`
      CREATE TABLE IF NOT EXISTS drums (
        id SERIAL PRIMARY KEY,
        kod_bebna VARCHAR(50) UNIQUE NOT NULL,
        nazwa TEXT NOT NULL,
        cecha TEXT,
        data_zwrotu_do_dostawcy DATE,
        kon_dostawca TEXT,
        pelna_nazwa_kontrahenta TEXT,
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

    // Reszta tabel bez zmian
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

    await sql`
      CREATE TABLE IF NOT EXISTS custom_return_periods (
        id SERIAL PRIMARY KEY,
        nip VARCHAR(10) UNIQUE REFERENCES companies(nip),
        return_period_days INTEGER NOT NULL DEFAULT 85,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

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

async function seedRealData(drumsData) {
  console.log(`🚀 Starting import of ${drumsData.length} real drums...`);
  
  try {
    // 1. Wyciągnij unikalne firmy z danych o bębnach
    console.log('📋 Extracting unique companies...');
    
    const companiesMap = new Map();
    
    drumsData.forEach(drum => {
      if (!companiesMap.has(drum.NIP)) {
        companiesMap.set(drum.NIP, {
          nip: drum.NIP,
          name: drum.PELNA_NAZWA_KONTRAHENTA,
          // Domyślne dane - możesz je później zaktualizować
          email: `kontakt@${drum.NIP}.pl`,
          phone: '+48 000 000 000',
          address: 'Adres do uzupełnienia'
        });
      }
    });

    const companies = Array.from(companiesMap.values());
    console.log(`📊 Found ${companies.length} unique companies`);

    // 2. Wstaw firmy
    console.log('💾 Inserting companies...');
    
    let companiesInserted = 0;
    for (const company of companies) {
      try {
        await sql`
          INSERT INTO companies (nip, name, email, phone, address, status, last_activity)
          VALUES (
            ${company.nip},
            ${company.name},
            ${company.email},
            ${company.phone},
            ${company.address},
            'Aktywny',
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (nip) DO UPDATE SET
            name = EXCLUDED.name,
            last_activity = CURRENT_TIMESTAMP
        `;
        companiesInserted++;
        
        if (companiesInserted % 10 === 0) {
          console.log(`  📈 Inserted ${companiesInserted}/${companies.length} companies`);
        }
      } catch (error) {
        console.warn(`⚠️ Warning inserting company ${company.nip}:`, error.message);
      }
    }

    console.log(`✅ Successfully inserted ${companiesInserted} companies`);

    // 3. Wstaw wszystkie bębny
    console.log('🥁 Inserting drums...');
    
    let drumsInserted = 0;
    const batchSize = 50; // Wstawiaj w batches żeby nie przeciążyć
    
    for (let i = 0; i < drumsData.length; i += batchSize) {
      const batch = drumsData.slice(i, i + batchSize);
      
      for (const drum of batch) {
        try {
          // Parsuj daty
          const parseDate = (dateStr) => {
            if (!dateStr || dateStr === ' ' || dateStr === '') return null;
            const date = new Date(dateStr);
            return isNaN(date) ? null : date.toISOString().split('T')[0];
          };

          await sql`
            INSERT INTO drums (
              kod_bebna, nazwa, cecha, data_zwrotu_do_dostawcy, 
              kon_dostawca, pelna_nazwa_kontrahenta, nip, typ_dok, 
              nr_dokumentupz, data_przyjecia_na_stan, kontrahent, 
              status, data_wydania
            ) VALUES (
              ${drum.KOD_BEBNA || ''},
              ${drum.NAZWA || ''},
              ${drum.CECHA || ''},
              ${parseDate(drum.DATA_ZWROTU_DO_DOSTAWCY)},
              ${drum.KON_DOSTAWCA || ''},
              ${drum.PELNA_NAZWA_KONTRAHENTA || ''},
              ${drum.NIP || ''},
              ${drum.TYP_DOK || ''},
              ${drum.NR_DOKUMENTUPZ || ''},
              ${parseDate(drum['Data przyjęcia na stan'])},
              ${drum.KONTRAHENT || ''},
              ${drum.STATUS || 'Aktywny'},
              ${parseDate(drum.DATA_WYDANIA)}
            )
            ON CONFLICT (kod_bebna) DO UPDATE SET
              nazwa = EXCLUDED.nazwa,
              data_zwrotu_do_dostawcy = EXCLUDED.data_zwrotu_do_dostawcy,
              status = EXCLUDED.status
          `;
          drumsInserted++;
          
        } catch (error) {
          console.warn(`⚠️ Warning inserting drum ${drum.KOD_BEBNA}:`, error.message);
        }
      }
      
      console.log(`  🔄 Progress: ${Math.min(i + batchSize, drumsData.length)}/${drumsData.length} drums processed`);
    }

    console.log(`✅ Successfully inserted ${drumsInserted} drums`);

    // 4. Dodaj administratorów
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

    console.log('✅ Admin users added');

    console.log('🎉 REAL DATA IMPORT COMPLETED SUCCESSFULLY! 🎉');
    console.log(`📊 Final stats:`);
    console.log(`   • Companies: ${companiesInserted}`);
    console.log(`   • Drums: ${drumsInserted}`);
    console.log(`   • Admins: ${admins.length}`);
    
  } catch (error) {
    console.error('❌ Error seeding real data:', error);
    throw error;
  }
}

// Export funkcji
module.exports = {
  createTables,
  seedRealData,
  runMigration: async (drumsData = null) => {
    console.log('🚀 Starting REAL DATA migration...');
    
    if (!drumsData || drumsData.length === 0) {
      throw new Error('❌ No drums data provided! Please pass mockDrumsData array.');
    }
    
    try {
      await createTables();
      await seedRealData(drumsData);
      console.log('✅ REAL DATA Migration completed successfully!');
      
      // Zwróć statystyki
      const companiesCount = new Set(drumsData.map(d => d.NIP)).size;
      
      return {
        success: true,
        stats: {
          totalDrums: drumsData.length,
          uniqueCompanies: companiesCount,
          adminAccounts: 2
        }
      };
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }
};
