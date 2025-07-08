// api/auth/login.js - Endpoint logowania (CommonJS)
const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
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
      usage: 'POST /api/auth/login with { "nip": "...", "password": "...", "role": "client|admin" }'
    });
  }

  const { nip, password, role = 'client' } = req.body;

  if (!nip || !password) {
    return res.status(400).json({ 
      message: 'Missing required fields',
      required: ['nip', 'password']
    });
  }

  try {
    console.log(`🔐 Login attempt for NIP: ${nip}, Role: ${role}`);

    let user = null;
    let tableName = '';
    let loginField = '';

    if (role === 'admin') {
      // Logowanie administratora
      tableName = 'admin_users';
      loginField = 'nip';
      
      const { rows } = await sql`
        SELECT id, nip, username, name, email, role, password_hash, is_active 
        FROM admin_users 
        WHERE nip = ${nip} AND is_active = true
      `;
      user = rows[0];
    } else {
      // Logowanie klienta
      tableName = 'users';
      loginField = 'nip';
      
      const { rows } = await sql`
        SELECT u.id, u.nip, u.password_hash, u.is_first_login, u.company,
               c.name as company_name, c.email, c.phone, c.address, c.status
        FROM users u
        LEFT JOIN companies c ON u.nip = c.nip
        WHERE u.nip = ${nip}
      `;
      user = rows[0];
    }

    if (!user) {
      return res.status(401).json({ 
        message: role === 'admin' ? 'Administrator not found or inactive' : 'Client not found',
        details: `No ${role} account found for NIP: ${nip}`
      });
    }

    // Sprawdź hasło
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Invalid password',
        details: 'Password does not match'
      });
    }

    // Aktualizuj czas ostatniego logowania
    if (role === 'admin') {
      await sql`UPDATE admin_users SET last_login = NOW() WHERE nip = ${nip}`;
    } else {
      await sql`UPDATE users SET last_login = NOW() WHERE nip = ${nip}`;
    }

    // Generuj JWT token
    const tokenPayload = {
      id: user.id,
      login: user.nip,
      role: role,
      nip: user.nip
    };

    if (role === 'admin') {
      tokenPayload.username = user.username;
      tokenPayload.name = user.name;
      tokenPayload.email = user.email;
      tokenPayload.permissions = user.permissions || {};
    } else {
      tokenPayload.company = user.company;
      tokenPayload.company_name = user.company_name;
      tokenPayload.is_first_login = user.is_first_login;
    }

    const token = jwt.sign(
      tokenPayload,
      process.env.STACK_SECRET_SERVER_KEY,
      { expiresIn: '7d' }
    );

    console.log(`✅ Login successful for ${role}: ${nip}`);

    // Odpowiedź z tokenem i danymi użytkownika
    const response = {
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        nip: user.nip,
        role: role
      }
    };

    if (role === 'admin') {
      response.user.username = user.username;
      response.user.name = user.name;
      response.user.email = user.email;
      response.user.permissions = user.permissions || {};
    } else {
      response.user.company = user.company;
      response.user.company_name = user.company_name;
      response.user.is_first_login = user.is_first_login;
      
      // Jeśli to pierwsze logowanie, przekieruj na ustawienie hasła
      if (user.is_first_login) {
        response.requires_password_setup = true;
        response.message = 'First login detected. Password setup required.';
      }
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ Login Error:', error);
    res.status(500).json({ 
      message: 'Internal server error during login',
      error: error.message,
      details: 'Check server logs for more information'
    });
  }
};
