// api/auth/login.js - Aktualizacja dla Supabase
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      message: 'Method Not Allowed',
      usage: 'POST /api/auth/login with { "nip": "...", "password": "...", "role": "client|admin" }'
    });
  }

  const { nip, password, role = 'client' } = req.body;

  if (!nip || !password) {
    return res.status(400).json({ 
      message: 'Missing required fields',
      required: ['nip', 'password'],
      optional: ['role']
    });
  }

  try {
    console.log(`🔐 Login attempt for NIP: ${nip}, Role: ${role}`);

    let user = null;
    let isPasswordCorrect = false;
    let isFirstLogin = false;

    if (role === 'admin' || role === 'supervisor') {
      // Admin/Supervisor login
      console.log('👑 Attempting admin login...');
      
      try {
        const { rows } = await sql`
          SELECT * FROM admin_users 
          WHERE nip = ${nip} AND is_active = true
        `;
        
        if (rows.length > 0) {
          user = rows[0];
          
          // Check if this is first login (no password set)
          if (!user.password_hash) {
            isFirstLogin = true;
            console.log('🆕 First login detected for admin');
            return res.status(200).json({
              success: true,
              firstLogin: true,
              user: {
                nip: user.nip,
                username: user.username,
                name: user.name,
                role: user.role,
                isFirstLogin: true
              },
              message: 'First login - please set your password'
            });
          } else {
            isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
          }
        }
      } catch (error) {
        console.error('❌ Admin login query error:', error);
        return res.status(500).json({ 
          message: 'Database error during admin authentication',
          error: error.message 
        });
      }
      
    } else {
      // Client login
      console.log('👤 Attempting client login...');
      
      try {
        const { rows } = await sql`
          SELECT u.*, c.name as company_name 
          FROM users u 
          LEFT JOIN companies c ON u.nip = c.nip
          WHERE u.nip = ${nip}
        `;
        
        if (rows.length > 0) {
          user = rows[0];
          isFirstLogin = user.is_first_login || false;
          
          if (isFirstLogin) {
            console.log('🆕 First login detected for client');
            return res.status(200).json({
              success: true,
              firstLogin: true,
              user: {
                nip: user.nip,
                companyName: user.company_name || user.company,
                fullName: user.company_name || user.company,
                role: 'client',
                isFirstLogin: true
              },
              company: {
                name: user.company_name || user.company
              },
              message: 'First login - please set your password'
            });
          } else {
            isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
          }
        }
      } catch (error) {
        console.error('❌ Client login query error:', error);
        return res.status(500).json({ 
          message: 'Database error during client authentication',
          error: error.message 
        });
      }
    }

    // Check if user exists and password is correct
    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({ 
        message: role === 'admin' ? 'Admin account not found for this NIP' : 'Client account not found for this NIP',
        suggestion: 'Please check your NIP and try again'
      });
    }

    if (!isPasswordCorrect && !isFirstLogin) {
      console.log('❌ Invalid password');
      return res.status(401).json({ 
        message: 'Invalid password',
        suggestion: 'Please check your password and try again'
      });
    }

    // Update last login time if login successful
    if (isPasswordCorrect) {
      try {
        if (role === 'admin' || role === 'supervisor') {
          await sql`
            UPDATE admin_users 
            SET last_login = NOW() 
            WHERE id = ${user.id}
          `;
        } else {
          await sql`
            UPDATE users 
            SET last_login = NOW(), is_first_login = FALSE 
            WHERE id = ${user.id}
          `;
        }
      } catch (error) {
        console.warn('⚠️ Could not update last login time:', error);
        // Don't fail the login for this
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
      ...(role === 'admin' || role === 'supervisor' ? {
        username: user.username,
        name: user.name,
        email: user.email
      } : {
        companyName: user.company_name || user.company,
        fullName: user.company_name || user.company
      })
    };

    console.log('✅ Login successful for:', user.nip);

    res.status(200).json({
      success: true,
      token,
      user: userResponse,
      message: 'Login successful',
      expiresIn: '24h'
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    
    res.status(500).json({
      message: 'Internal server error during authentication',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Authentication failed',
      timestamp: new Date().toISOString()
    });
  }
}