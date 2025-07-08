// api/auth/register.js - Endpoint do ustawiania hasła przy pierwszym logowaniu
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      message: 'Method Not Allowed',
      usage: 'POST /api/auth/register with { "nip": "...", "password": "...", "confirmPassword": "...", "role": "client|admin" }'
    });
  }

  const { nip, password, confirmPassword, role = 'client' } = req.body;

  if (!nip || !password || !confirmPassword) {
    return res.status(400).json({ 
      message: 'Missing required fields',
      required: ['nip', 'password', 'confirmPassword']
    });
  }

  // Validate password match
  if (password !== confirmPassword) {
    return res.status(400).json({ 
      message: 'Passwords do not match',
      details: 'Password and confirmation password must be identical'
    });
  }

  // Validate password strength
  if (password.length < 6) {
    return res.status(400).json({ 
      message: 'Password must be at least 6 characters long',
      requirements: ['Minimum 6 characters']
    });
  }

  try {
    console.log(`🔐 Setting password for NIP: ${nip}, Role: ${role}`);

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    let user = null;
    let updateResult = null;

    if (role === 'admin' || role === 'supervisor') {
      // Update admin password
      console.log('👑 Setting admin password...');
      
      try {
        const { rows } = await sql`
          UPDATE admin_users 
          SET password_hash = ${hashedPassword}, last_login = NOW()
          WHERE nip = ${nip} AND is_active = true AND (password_hash IS NULL OR password_hash = '')
          RETURNING id, nip, username, name, email, role
        `;
        
        if (rows.length === 0) {
          return res.status(404).json({ 
            message: 'Admin account not found or password already set',
            suggestion: 'Check NIP or contact system administrator'
          });
        }
        
        user = rows[0];
        updateResult = 'admin';
        
      } catch (error) {
        console.error('❌ Admin password update error:', error);
        return res.status(500).json({ 
          message: 'Database error during admin password setup',
          error: error.message 
        });
      }
      
    } else {
      // Update client password
      console.log('👤 Setting client password...');
      
      try {
        const { rows } = await sql`
          UPDATE users 
          SET password_hash = ${hashedPassword}, is_first_login = FALSE, last_login = NOW()
          WHERE nip = ${nip} AND is_first_login = true
          RETURNING id, nip, company
        `;
        
        if (rows.length === 0) {
          return res.status(404).json({ 
            message: 'Client account not found or password already set',
            suggestion: 'Check NIP or contact system administrator'
          });
        }
        
        user = rows[0];
        updateResult = 'client';
        
        // Get company details
        const { rows: companyRows } = await sql`
          SELECT name FROM companies WHERE nip = ${nip}
        `;
        
        if (companyRows.length > 0) {
          user.companyName = companyRows[0].name;
        }
        
      } catch (error) {
        console.error('❌ Client password update error:', error);
        return res.status(500).json({ 
          message: 'Database error during client password setup',
          error: error.message 
        });
      }
    }

    // Generate JWT token
    const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'fallback-secret-key';
    
    const tokenPayload = {
      userId: user.id,
      nip: user.nip,
      role: user.role || 'client',
      username: user.username || null,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET);

    // Prepare user response
    const userResponse = {
      id: user.id,
      nip: user.nip,
      role: user.role || 'client',
      ...(updateResult === 'admin' ? {
        username: user.username,
        name: user.name,
        email: user.email
      } : {
        companyName: user.companyName || user.company,
        fullName: user.companyName || user.company
      })
    };

    console.log('✅ Password set successfully for:', user.nip);

    res.status(200).json({
      success: true,
      token,
      user: userResponse,
      message: 'Password set successfully - you are now logged in',
      expiresIn: '24h'
    });

  } catch (error) {
    console.error('❌ Password setup error:', error);
    
    res.status(500).json({
      message: 'Internal server error during password setup',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Password setup failed',
      timestamp: new Date().toISOString()
    });
  }
}