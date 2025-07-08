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
      usage: 'POST /api/auth/register with { "nip": "...", "password": "...", "confirmPassword": "...", "role": "client|admin" }'
    })
  }

  const { nip, password, confirmPassword, role = 'client' } = req.body

  if (!nip || !password || !confirmPassword) {
    return res.status(400).json({ 
      message: 'Missing required fields',
      required: ['nip', 'password', 'confirmPassword']
    })
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ 
      message: 'Passwords do not match'
    })
  }

  if (password.length < 6) {
    return res.status(400).json({ 
      message: 'Password must be at least 6 characters long'
    })
  }

  try {
    console.log(`🔐 Setting password for NIP: ${nip}, Role: ${role}`)

    const hashedPassword = await bcrypt.hash(password, 12)
    let user = null

    if (role === 'admin' || role === 'supervisor') {
      // Update admin password
      const { data, error } = await supabaseAdmin
        .from('admin_users')
        .update({ 
          password_hash: hashedPassword,
          last_login: new Date().toISOString()
        })
        .eq('nip', nip)
        .eq('is_active', true)
        .is('password_hash', null)
        .select()
        .single()
      
      if (error || !data) {
        return res.status(404).json({ 
          message: 'Admin account not found or password already set'
        })
      }
      
      user = data
      
    } else {
      // Update client password
      const { data, error } = await supabaseAdmin
        .from('users')
        .update({ 
          password_hash: hashedPassword,
          is_first_login: false,
          last_login: new Date().toISOString()
        })
        .eq('nip', nip)
        .eq('is_first_login', true)
        .select(`
          id, nip, company,
          companies (name, email)
        `)
        .single()
      
      if (error || !data) {
        return res.status(404).json({ 
          message: 'Client account not found or password already set'
        })
      }
      
      user = data
    }

    // Create JWT token
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

    console.log(`✅ Password set successfully for ${role}: ${user.nip}`)

    res.status(200).json({
      success: true,
      message: 'Password set successfully',
      token,
      user: {
        id: user.id,
        nip: user.nip,
        role: role,
        name: role === 'admin' ? user.name : user.companies?.name,
        email: role === 'admin' ? user.email : user.companies?.email,
        isFirstLogin: false
      }
    })

  } catch (error) {
    console.error('❌ Registration Error:', error)
    res.status(500).json({ 
      message: 'Internal Server Error', 
      error: error.message
    })
  }
}
