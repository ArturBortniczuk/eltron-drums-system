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
      error: 'Method not allowed. Use POST to migrate data.',
      usage: 'POST /api/migrate with { "key": "migrate-eltron-2024", "drumsData": [...] }'
    })
  }

  try {
    const { key, drumsData } = req.body

    if (key !== 'migrate-eltron-2024') {
      return res.status(401).json({ error: 'Invalid migration key' })
    }

    if (!drumsData || !Array.isArray(drumsData) || drumsData.length === 0) {
      return res.status(400).json({ 
        error: 'No drums data provided',
        details: 'Please provide drumsData array with your drums data'
      })
    }

    console.log(`🚀 Starting migration of ${drumsData.length} drums to Supabase...`)

    const stats = {
      totalDrumsProcessed: 0,
      uniqueDrumsImported: 0,
      companiesCreated: 0,
      clientAccountsCreated: 0,
      errors: []
    }

    // ========== KROK 1: WYCIĄGNIJ UNIKALNE FIRMY ==========
    console.log('📋 Extracting unique companies from drums data...')
    
    const companiesMap = new Map()
    
    drumsData.forEach(drum => {
      const nip = drum.NIP
      const companyName = drum.PELNA_NAZWA_KONTRAHENTA
      
      if (nip && companyName && !companiesMap.has(nip)) {
        companiesMap.set(nip, {
          nip: nip,
          name: companyName,
          email: `kontakt@${nip}.pl`,
          phone: '+48 000 000 000',
          address: 'Adres do uzupełnienia',
          status: 'Aktywny'
        })
      }
    })

    const companies = Array.from(companiesMap.values())
    console.log(`📊 Found ${companies.length} unique companies`)

    // ========== KROK 2: WSTAW FIRMY ==========
    console.log('💾 Inserting companies into Supabase...')
    
    for (const company of companies) {
      try {
        const { data, error } = await supabaseAdmin
          .from('companies')
          .insert([company])
          .select()

        if (error && !error.message.includes('duplicate')) {
          throw error
        }

        if (!error) {
          stats.companiesCreated++
          console.log(`✅ Company created: ${company.name}`)
        }
      } catch (error) {
        stats.errors.push(`Company ${company.nip}: ${error.message}`)
        console.warn(`⚠️ Error inserting company ${company.nip}:`, error.message)
      }
    }

    // ========== KROK 3: WSTAW BĘBNY ==========
    console.log('🥁 Inserting drums into Supabase...')
    
    for (const drum of drumsData) {
      try {
        stats.totalDrumsProcessed++
        
        // Parsuj daty
        const parseDate = (dateStr) => {
          if (!dateStr || dateStr === ' ' || dateStr === '') return null
          const date = new Date(dateStr)
          return isNaN(date) ? null : date.toISOString().split('T')[0]
        }

        const drumData = {
          kod_bebna: drum.KOD_BEBNA || '',
          nazwa: drum.NAZWA || '',
          cecha: drum.CECHA || null,
          data_zwrotu_do_dostawcy: parseDate(drum.DATA_ZWROTU_DO_DOSTAWCY),
          kon_dostawca: drum.KON_DOSTAWCA || null,
          pelna_nazwa_kontrahenta: drum.PELNA_NAZWA_KONTRAHENTA || '',
          nip: drum.NIP || '',
          typ_dok: drum.TYP_DOK || null,
          nr_dokumentupz: drum.NR_DOKUMENTUPZ || null,
          data_przyjecia_na_stan: parseDate(drum['Data przyjęcia na stan']),
          kontrahent: drum.KONTRAHENT || null,
          status: drum.STATUS || 'Aktywny',
          data_wydania: parseDate(drum.DATA_WYDANIA)
        }

        const { data, error } = await supabaseAdmin
          .from('drums')
          .upsert([drumData], { 
            onConflict: 'kod_bebna',
            ignoreDuplicates: false 
          })
          .select()

        if (!error) {
          stats.uniqueDrumsImported++
        } else {
          stats.errors.push(`Drum ${drum.KOD_BEBNA}: ${error.message}`)
        }
        
      } catch (error) {
        console.warn(`⚠️ Warning inserting drum ${drum.KOD_BEBNA}:`, error.message)
        stats.errors.push(`Drum ${drum.KOD_BEBNA}: ${error.message}`)
      }
    }

    // ========== KROK 4: UTWÓRZ KONTA KLIENTÓW ==========
    console.log('👤 Creating client accounts...')
    
    for (const company of companies) {
      try {
        const { data, error } = await supabaseAdmin
          .from('users')
          .insert([{
            nip: company.nip,
            company: company.name,
            is_first_login: true,
            password_hash: null // Hasło zostanie ustawione przy pierwszym logowaniu
          }])
          .select()

        if (error && !error.message.includes('duplicate')) {
          throw error
        }

        if (!error) {
          stats.clientAccountsCreated++
          console.log(`✅ Client account created for: ${company.name}`)
        }
      } catch (error) {
        stats.errors.push(`Client account ${company.nip}: ${error.message}`)
        console.warn(`⚠️ Error creating client account ${company.nip}:`, error.message)
      }
    }

    console.log('🎉 Migration completed!')
    console.log(`📊 Final stats:`)
    console.log(`   • Companies: ${stats.companiesCreated}`)
    console.log(`   • Drums: ${stats.uniqueDrumsImported}/${stats.totalDrumsProcessed}`)
    console.log(`   • Client accounts: ${stats.clientAccountsCreated}`)
    console.log(`   • Errors: ${stats.errors.length}`)

    // Przygotuj testowe konta
    const testAccounts = [
      { type: 'Admin', nip: '0000000000', username: 'admin', note: 'Set password using /api/auth/register' },
      { type: 'Supervisor', nip: '1111111111', username: 'supervisor', note: 'Set password using /api/auth/register' }
    ]

    // Dodaj kilka klientów testowych
    companies.slice(0, 5).forEach(company => {
      testAccounts.push({
        type: 'Client',
        nip: company.nip,
        company: company.name,
        note: 'Set password using /api/auth/register'
      })
    })

    return res.status(200).json({
      success: true,
      message: '🎉 Data migration completed successfully!',
      database: 'Supabase PostgreSQL',
      stats: stats,
      testAccounts: testAccounts,
      nextSteps: [
        '1. Check /api/health to verify everything works',
        '2. Set passwords for admin accounts using /api/auth/register',
        '3. Set passwords for client accounts using /api/auth/register',
        '4. Test login with /api/auth/login',
        '5. Start using the system!'
      ],
      summary: {
        companiesProcessed: stats.companiesCreated,
        drumsImported: stats.uniqueDrumsImported,
        accountsCreated: stats.clientAccountsCreated + 2, // +2 for admin accounts
        errorsCount: stats.errors.length
      }
    })

  } catch (error) {
    console.error('❌ Migration failed:', error)
    
    return res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
