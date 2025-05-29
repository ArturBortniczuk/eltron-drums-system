// api/migrate.js - ZAKTUALIZOWANY dla realnych danych
const { createTables, seedRealData } = require('../migrations/001_initial_migration');

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
      error: 'Method not allowed. Use POST to run migration.',
      usage: 'POST /api/migrate with { "key": "migrate-eltron-2024", "drumsData": [...] }'
    });
  }

  // Autoryzacja
  const { key, drumsData } = req.body;
  if (key !== 'migrate-eltron-2024') {
    return res.status(401).json({ error: 'Invalid migration key' });
  }

  // Sprawdź czy dane zostały przekazane
  if (!drumsData || !Array.isArray(drumsData) || drumsData.length === 0) {
    return res.status(400).json({ 
      error: 'No drums data provided',
      message: 'Please include drumsData array in request body',
      example: {
        key: 'migrate-eltron-2024',
        drumsData: [
          {
            KOD_BEBNA: 'BEB001',
            NAZWA: 'Example drum',
            NIP: '1234567890',
            // ... other fields
          }
        ]
      }
    });
  }

  try {
    console.log(`🚀 Starting migration with ${drumsData.length} drums...`);
    
    // Walidacja podstawowej struktury danych
    const requiredFields = ['KOD_BEBNA', 'NAZWA', 'NIP', 'PELNA_NAZWA_KONTRAHENTA'];
    const firstDrum = drumsData[0];
    const missingFields = requiredFields.filter(field => !(field in firstDrum));
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Invalid data structure',
        message: `Missing required fields: ${missingFields.join(', ')}`,
        receivedFields: Object.keys(firstDrum)
      });
    }

    await createTables();
    await seedRealData(drumsData);
    
    // Oblicz statystyki
    const uniqueCompanies = new Set(drumsData.map(d => d.NIP)).size;
    const uniqueDrums = new Set(drumsData.map(d => d.KOD_BEBNA)).size;
    
    return res.status(200).json({
      success: true,
      message: '🎉 Real data migration completed successfully!',
      stats: {
        totalDrumsProcessed: drumsData.length,
        uniqueDrumsImported: uniqueDrums,
        companiesCreated: uniqueCompanies,
        adminAccountsCreated: 2
      },
      testAccounts: [
        { type: 'Admin', nip: '0000000000', note: 'Set password on first login' },
        { type: 'Supervisor', nip: '1111111111', note: 'Set password on first login' }
      ],
      nextSteps: [
        '1. Test login with any NIP from your data',
        '2. Set password on first login',
        '3. Check /api/health endpoint',
        '4. Start using the system!'
      ]
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
