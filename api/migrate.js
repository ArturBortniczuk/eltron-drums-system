// api/migrate.js - Import danych z mockData.js do Supabase
const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');

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
      error: 'Method not allowed. Use POST to migrate data.',
      usage: 'POST /api/migrate with { "key": "migrate-eltron-2024", "drumsData": [...] }'
    });
  }

  try {
    const { key, drumsData } = req.body;

    // Autoryzacja
    if (key !== 'migrate-eltron-2024') {
      return res.status(401).json({ error: 'Invalid migration key' });
    }

    if (!drumsData || !Array.isArray(drumsData) || drumsData.length === 0) {
      return res.status(400).json({ 
        error: 'No drums data provided',
        details: 'Please provide drumsData array with your drums data'
      });
    }

    console.log(`🚀 Starting migration of ${drumsData.length} drums to Supabase...`);

    // Test połączenia
    try {
      await sql`SELECT 1 as test`;
      console.log('✅ Supabase connection successful');
    } catch (error) {
      return res.status(500).json({
        error: 'Supabase connection failed',
        details: error.message
      });
    }

    const stats = {
      totalDrumsProcessed: 0,
      uniqueDrumsImported: 0,
      companiesCreated: 0,
      adminAccountsCreated: 0,
      errors: []
    };

    // ========== KROK 1: WYCIĄGNIJ UNIKALNE FIRMY ==========
    console.log('📋 Extracting unique companies from drums data...');
    
    const companiesMap = new Map();
    
    drumsData.forEach(drum => {
      const nip = drum.NIP;
      const companyName = drum.PELNA_NAZWA_KONTRAHENTA;
      
      if (nip && companyName && !companiesMap.has(nip)) {
        companiesMap.set(nip, {
          nip: nip,
          name: companyName,
          email: `kontakt@${nip}.pl`,
          phone: '+48 000 000 000',
          address: 'Adres do uzupełnienia',
          status: 'Aktywny'
        });
      }
    });

    const companies = Array.from(companiesMap.values());
    console.log(`📊 Found ${companies.length} unique companies`);

    // ========== KROK 2: WSTAW FIRMY ==========
    console.log('💾 Inserting companies into Supabase...');
    
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
            ${company.status},
            NOW()
          )
          ON CONFLICT (nip) DO UPDATE SET
            name = EXCLUDED.name,
            last_activity = NOW()
        `;
        companiesInserted++;
        
        if (companiesInserted % 10 === 0) {
          console.log(`  📈 Inserted ${companiesInserted}/${companies.length} companies`);
        }
      } catch (error) {
        console.warn(`⚠️ Warning inserting company ${company.nip}:`, error.message);
        stats.errors.push(`Company ${company.nip}: ${error.message}`);
      }
    }

    stats.companiesCreated = companiesInserted;
    console.log(`✅ Successfully inserted ${companiesInserted} companies`);

    // ========== KROK 3: WSTAW BĘBNY ==========
    console.log('🥁 Inserting drums into Supabase...');
    
    let drumsInserted = 0;
    const batchSize = 50;
    
    for (let i = 0; i < drumsData.length; i += batchSize) {
      const batch = drumsData.slice(i, i + batchSize);
      
      for (const drum of batch) {
        try {
          stats.totalDrumsProcessed++;
          
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
          stats.errors.push(`Drum ${drum.KOD_BEBNA}: ${error.message}`);
        }
      }
      
      console.log(`  🔄 Progress: ${Math.min(i + batchSize, drumsData.length)}/${drumsData.length} drums processed`);
    }

    stats.uniqueDrumsImported = drumsInserted;
    console.log(`✅ Successfully inserted ${drumsInserted} drums`);

    // ========== KROK 4: UTWÓRZ KONTA KLIENTÓW ==========
    console.log('👥 Creating client accounts...');
    
    let clientAccountsCreated = 0;
    
    // Stwórz konta dla pierwszych kilku firm (jako przykład)
    const testClients = companies.slice(0, Math.min(5, companies.length));
    
    for (const company of testClients) {
      try {
        const defaultPassword = 'password123';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        
        await sql`
          INSERT INTO users (nip, password_hash, company, is_first_login)
          VALUES (
            ${company.nip},
            ${hashedPassword},
            ${company.name},
            true
          )
          ON CONFLICT (nip) DO UPDATE SET
            company = EXCLUDED.company
        `;
        
        clientAccountsCreated++;
        
      } catch (error) {
        console.warn(`⚠️ Warning creating client account ${company.nip}:`, error.message);
        stats.errors.push(`Client account ${company.nip}: ${error.message}`);
      }
    }

    // ========== KROK 5: DODAJ ADMINISTRATORÓW ==========
    console.log('👑 Adding admin users...');
    
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
        
        stats.adminAccountsCreated++;
        
      } catch (error) {
        console.warn(`⚠️ Warning creating admin ${admin.username}:`, error.message);
        stats.errors.push(`Admin ${admin.username}: ${error.message}`);
      }
    }

    console.log('✅ Admin users added');

    console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY! 🎉');
    console.log(`📊 Final stats:`);
    console.log(`   • Companies: ${stats.companiesCreated}`);
    console.log(`   • Drums: ${stats.uniqueDrumsImported}/${stats.totalDrumsProcessed}`);
    console.log(`   • Client accounts: ${clientAccountsCreated}`);
    console.log(`   • Admin accounts: ${stats.adminAccountsCreated}`);
    console.log(`   • Errors: ${stats.errors.length}`);

    // Przygotuj przykładowe konta testowe
    const testAccounts = [
      { type: 'Admin', nip: '0000000000', username: 'admin', note: 'Set password on first login' },
      { type: 'Supervisor', nip: '1111111111', username: 'supervisor', note: 'Set password on first login' }
    ];

    // Dodaj kilka klient testowych
    testClients.forEach(client => {
      testAccounts.push({
        type: 'Client',
        nip: client.nip,
        company: client.name,
        note: 'Default password: password123'
      });
    });

    return res.status(200).json({
      success: true,
      message: '🎉 Data migration completed successfully!',
      database: 'Supabase PostgreSQL',
      stats: stats,
      testAccounts: testAccounts,
      nextSteps: [
        '1. Check /api/health to verify everything works',
        '2. Test login with admin accounts',
        '3. Test login with client accounts',
        '4. Start using the system!',
        '5. Configure additional client accounts as needed'
      ],
      summary: {
        companiesProcessed: stats.companiesCreated,
        drumsImported: stats.uniqueDrumsImported,
        accountsCreated: stats.adminAccountsCreated + clientAccountsCreated,
        errorsCount: stats.errors.length
      }
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message,
      timestamp: new Date().toISOString(),
      suggestion: 'Check database connection and data format'
    });
  }
};