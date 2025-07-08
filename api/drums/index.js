import { supabaseAdmin } from '../../utils/supabase/server.js'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  const { method } = req

  // Autoryzacja
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' })
  }

  const token = authHeader.split(' ')[1]
  let decoded
  try {
    decoded = jwt.verify(token, process.env.STACK_SECRET_SERVER_KEY)
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }

  switch (method) {
    case 'GET':
      try {
        let drumsQuery = supabaseAdmin.from('drums').select('*')
        
        // Klienci widzą tylko swoje bębny
        if (decoded.role !== 'admin') {
          drumsQuery = drumsQuery.eq('nip', decoded.nip)
        }

        const { data: drums, error } = await drumsQuery.order('created_at', { ascending: false })

        if (error) {
          throw error
        }

        // Wzbogać dane o dodatkowe informacje
        const enrichedDrums = drums.map(drum => ({
          ...drum,
          days_until_return: drum.data_zwrotu_do_dostawcy ? 
            Math.ceil((new Date(drum.data_zwrotu_do_dostawcy) - new Date()) / (1000 * 60 * 60 * 24)) : null,
          is_overdue: drum.data_zwrotu_do_dostawcy ? 
            new Date(drum.data_zwrotu_do_dostawcy) < new Date() : false,
          is_warning: drum.data_zwrotu_do_dostawcy ? 
            (new Date(drum.data_zwrotu_do_dostawcy) - new Date()) / (1000 * 60 * 60 * 24) <= 30 : false,
          formatted_return_date: drum.data_zwrotu_do_dostawcy ? 
            new Date(drum.data_zwrotu_do_dostawcy).toLocaleDateString('pl-PL') : null,
          formatted_received_date: drum.data_przyjecia_na_stan ? 
            new Date(drum.data_przyjecia_na_stan).toLocaleDateString('pl-PL') : null,
          formatted_issued_date: drum.data_wydania ? 
            new Date(drum.data_wydania).toLocaleDateString('pl-PL') : null
        }))

        res.status(200).json({
          success: true,
          count: enrichedDrums.length,
          drums: enrichedDrums,
          user_role: decoded.role,
          user_nip: decoded.nip
        })

      } catch (error) {
        console.error('❌ Drums GET Error:', error)
        res.status(500).json({ 
          message: 'Internal Server Error', 
          error: error.message
        })
      }
      break

    case 'POST':
      // Tylko admin może dodawać nowe bębny
      if (decoded.role !== 'admin') {
        return res.status(403).json({ 
          message: 'Forbidden - Admin access required'
        })
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
        } = req.body

        if (!kod_bebna || !nip) {
          return res.status(400).json({ 
            message: 'Missing required fields',
            required: ['kod_bebna', 'nip']
          })
        }

        // Sprawdź czy firma istnieje
        const { data: company, error: companyError } = await supabaseAdmin
          .from('companies')
          .select('nip, name')
          .eq('nip', nip)
          .single()

        if (companyError || !company) {
          return res.status(400).json({ 
            message: 'Company not found',
            details: `No company found with NIP: ${nip}`
          })
        }

        // Dodaj nowy bęben
        const { data: newDrum, error } = await supabaseAdmin
          .from('drums')
          .insert([{
            kod_bebna,
            nazwa,
            nip,
            data_zwrotu_do_dostawcy,
            pelna_nazwa_kontrahenta: pelna_nazwa_kontrahenta || company.name,
            cecha,
            kon_dostawca,
            typ_dok,
            nr_dokumentupz,
            data_przyjecia_na_stan,
            kontrahent,
            data_wydania,
            status: 'Aktywny'
          }])
          .select()
          .single()

        if (error) {
          if (error.code === '23505') { // Unique violation
            return res.status(409).json({ 
              message: 'Drum code already exists'
            })
          }
          throw error
        }

        console.log(`✅ Admin ${decoded.nip} created drum: ${kod_bebna}`)

        res.status(201).json({
          success: true,
          message: 'Drum created successfully',
          drum: newDrum
        })

      } catch (error) {
        console.error('❌ Drums POST Error:', error)
        res.status(500).json({ 
          message: 'Internal Server Error', 
          error: error.message
        })
      }
      break

    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).json({ 
        message: `Method ${method} Not Allowed`
      })
  }
}
