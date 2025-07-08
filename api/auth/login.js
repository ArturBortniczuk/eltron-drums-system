import { supabaseAdmin } from '../../utils/supabase/server.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      message: 'Method Not Allowed',
      usage: 'POST /api/auth/login with { "nip": "...", "password": "...", "role": "client|admin" }'
    })
  }

  const { nip, password, role = 'client' } = req.body

  if (!nip || !password) {
    return res.status(400).json({ 
      message: 'Missing required fields',
      required: ['nip', 'password']
    })
  }

  try {
    console.log(`🔐 Login attempt for NIP: ${nip}, Role: ${role}`)

    let user = null

    if (role === 'admin') {
      // Logowanie administratora
      const { data, error } = await supabaseAdmin
        .from('admin_users')
        .select('id, nip, username, name, email, role, password_hash, is_active')
        .eq('nip', nip)
        .eq('is_active', true)
        .single()

      if (error) {
        return res.status(401).json({ 
          message: 'Admin account not found or inactive',
          details: `No admin found with NIP: ${nip}`
        })
      }
      user = data
    } else {
      // Logowanie klienta
      const { data, error } = await supabaseAdmin
        .from('users')
        .select(`
          id, nip, password_hash, is_first_login, company,
          companies (name, email, phone, address, status)
        `)
        .eq('nip', nip)
        .single()

      if (error) {
        return res.status(401).json({ 
          message: 'Company account not found',
          details: `No client found with NIP: ${nip}`
        })
      }
      user = data
    }

    // Sprawdź hasło
    if (!user.password_hash) {
      return res.status(401).json({ 
        message: 'Password not set',
        details: 'Please set your password first using the registration endpoint',
        isFirstLogin: true,
        nip: nip,
        companyName: role === 'admin' ? user.name : user.companies?.name
      })
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash)
    if (!passwordValid) {
      return res.status(401).json({ 
        message: 'Invalid password',
        details: 'The provided password is incorrect'
      })
    }

    // Aktualizuj last_login
    if (role === 'admin') {
      await supabaseAdmin
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id)
    } else {
      await supabaseAdmin
        .from('users')
        .update({ 
          last_login: new Date().toISOString(),
          is_first_login: false 
        })
        .eq('id', user.id)
    }

    // Utwórz token JWT
    const tokenPayload = {
      id: user.id,
      nip: user.nip,
      role: role,
      name: role === 'admin' ? user.name : user.companies?.name,
      email: role === 'admin' ? user.email : user.companies?.email
    }

    const token = jwt.sign(
      tokenPayload,
      process.env.STACK_SECRET_SERVER_KEY || 'fallback-secret-key',
      { expiresIn: '24h' }
    )

    console.log(`✅ Login successful for ${role}: ${user.nip}`)

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        nip: user.nip,
        role: role,
        name: role === 'admin' ? user.name : user.companies?.name,
        email: role === 'admin' ? user.email : user.companies?.email,
        isFirstLogin: user.is_first_login || false
      }
    })

  } catch (error) {
    console.error('❌ Login Error:', error)
    res.status(500).json({ 
      message: 'Internal Server Error', 
      error: error.message
    })
  }
}
