// api/drums/index.js - Endpoint zarządzania bębnami (CommonJS)
const { sql } = require('@vercel/postgres');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Middleware do weryfikacji tokenu
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ 
      message: 'Authorization header missing',
      usage: 'Include "Authorization: Bearer <token>" header'
    });
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  
  try {
    decoded = jwt.verify(token, process.env.STACK_SECRET_SERVER_KEY);
    console.log('🔐 Authenticated user:', { nip: decoded.nip, role: decoded.role });
  } catch (error) {
    return res.status(401).json({ 
      message: 'Invalid or expired token',
      details: error.message
    });
  }

  const { method } = req;

  switch (method) {
    case 'GET':
      try {
        let drums;
        
        if (decoded.role === 'admin') {
          // Admin widzi wszystkie bębny z informacjami o firmach
          const { rows } = await sql`
            SELECT 
              d.*,
              c.name as company_name,
              c.email as company_email,
              c.phone as company_phone,
              c.status as company_status
            FROM drums d
            LEFT JOIN companies c ON d.nip = c.nip
            ORDER BY d.created_at DESC
          `;
          drums = rows;
          console.log(`📦 Admin retrieved ${drums.length} drums`);
        } else {
          // Klient widzi tylko swoje bębny
          const userNip = decoded.nip || decoded.login;
          const { rows } = await sql`
            SELECT 
              d.*,
              c.name as company_name
            FROM drums d
            LEFT JOIN companies c ON d.nip = c.nip
            WHERE d.nip = ${userNip}
            ORDER BY d.created_at DESC
          `;
          drums = rows;
          console.log(`📦 Client ${userNip} retrieved ${drums.length} drums`);
        }

        // Dodaj dodatkowe informacje do każdego bębna
        const enrichedDrums = drums.map(drum => ({
          ...drum,
          // Sprawdź czy data zwrotu jest bliska (30 dni)
          is_return_near: drum.data_zwrotu_do_dostawcy ? 
            (new Date(drum.data_zwrotu_do_dostawcy) - new Date()) / (1000 * 60 * 60 * 24) <= 30 : false,
          // Sformatuj daty
          formatted_return_date: drum.data_zwrotu_do_dostawcy ? 
            new Date(drum.data_zwrotu_do_dostawcy).toLocaleDateString('pl-PL') : null,
          formatted_received_date: drum.data_przyjecia_na_stan ? 
            new Date(drum.data_przyjecia_na_stan).toLocaleDateString('pl-PL') : null,
          formatted_issued_date: drum.data_wydania ? 
            new Date(drum.data_wydania).toLocaleDateString('pl-PL') : null
        }));

        res.status(200).json({
          success: true,
          count: enrichedDrums.length,
          drums: enrichedDrums,
          user_role: decoded.role,
          user_nip: decoded.nip || decoded.login
        });

      } catch (error) {
        console.error('❌ Drums GET Error:', error);
        res.status(500).json({ 
          message: 'Internal Server Error', 
          error: error.message,
          details: 'Failed to retrieve drums from database'
        });
      }
      break;

    case 'POST':
      // Tylko admin może dodawać nowe bębny
      if (decoded.role !== 'admin') {
        return res.status(403).json({ 
          message: 'Forbidden - Admin access required',
          user_role: decoded.role
        });
      }

      try {
        const { 
          kod_bebna, 
          nazwa, 
          nip, 
          data_zwrotu_do_dostawcy, 
          pelna_nazwa_kontrahenta,
          cecha,
          kon_dostawca,
          typ_dok,
          nr_dokumentupz,
          data_przyjecia_na_stan,
          kontrahent,
          data_wydania
        } = req.body;

        // Walidacja wymaganych pól
        if (!kod_bebna || !nip) {
          return res.status(400).json({ 
            message: 'Missing required fields',
            required: ['kod_bebna', 'nip'],
            received: req.body
          });
        }

        // Sprawdź czy firma istnieje
        const { rows: companyCheck } = await sql`
          SELECT nip, name FROM companies WHERE nip = ${nip}
        `;

        if (companyCheck.length === 0) {
          return res.status(400).json({ 
            message: 'Company not found',
            details: `No company found with NIP: ${nip}`,
            suggestion: 'Create the company first or check the NIP number'
          });
        }

        // Sprawdź czy bęben już istnieje
        const { rows: drumCheck } = await sql`
          SELECT kod_bebna FROM drums WHERE kod_bebna = ${kod_bebna}
        `;

        if (drumCheck.length > 0) {
          return res.status(409).json({ 
            message: 'Drum already exists',
            details: `Drum with code ${kod_bebna} already exists in database`
          });
        }

        // Dodaj nowy bęben
        const { rows } = await sql`
          INSERT INTO drums (
            kod_bebna, 
            nazwa, 
            nip, 
            data_zwrotu_do_dostawcy, 
            pelna_nazwa_kontrahenta,
            cecha,
            kon_dostawca,
            typ_dok,
            nr_dokumentupz,
            data_przyjecia_na_stan,
            kontrahent,
            data_wydania,
            status
          ) 
          VALUES (
            ${kod_bebna}, 
            ${nazwa}, 
            ${nip}, 
            ${data_zwrotu_do_dostawcy}, 
            ${pelna_nazwa_kontrahenta || companyCheck[0].name},
            ${cecha || null},
            ${kon_dostawca || null},
            ${typ_dok || null},
            ${nr_dokumentupz || null},
            ${data_przyjecia_na_stan || null},
            ${kontrahent || null},
            ${data_wydania || null},
            'Aktywny'
          ) 
          RETURNING *
        `;

        console.log(`✅ Admin ${decoded.nip} created drum: ${kod_bebna}`);

        res.status(201).json({
          success: true,
          message: 'Drum created successfully',
          drum: rows[0]
        });

      } catch (error) {
        console.error('❌ Drums POST Error:', error);
        
        if (error.code === '23505') { // Unique violation
          res.status(409).json({ 
            message: 'Drum code already exists',
            error: 'Duplicate drum code',
            details: 'A drum with this code already exists in the database'
          });
        } else {
          res.status(500).json({ 
            message: 'Internal Server Error', 
            error: error.message,
            details: 'Failed to create drum in database'
          });
        }
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ 
        message: `Method ${method} Not Allowed`,
        allowed_methods: ['GET', 'POST'],
        usage: {
          GET: 'Retrieve drums (all for admin, own for clients)',
          POST: 'Create new drum (admin only)'
        }
      });
  }
};
