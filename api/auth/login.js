// /api/auth/login.js

// Importujemy 'sql' z oficjalnego pakietu Vercel
import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { login, password, type } = req.body;

  if (!login || !password || !type) {
    return res.status(400).json({ message: 'Missing login, password, or type' });
  }

  try {
    let user = null;
    let isPasswordCorrect = false;

    if (type === 'admin') {
      // Używamy 'sql' do wykonania zapytania - jest bezpieczniejsze i zoptymalizowane
      const { rows } = await sql`
        SELECT * FROM admin_users WHERE login = ${login};
      `;
      if (rows.length > 0) {
        user = rows[0];
        isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
      }
    } else if (type === 'client') {
      const { rows } = await sql`
        SELECT * FROM users WHERE nip = ${login};
      `;
      if (rows.length > 0) {
        user = rows[0];
        isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
      }
    } else {
      return res.status(400).json({ message: 'Invalid user type' });
    }

    if (!user || !isPasswordCorrect) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generowanie tokenu JWT
    const token = jwt.sign(
      { userId: user.id, login: user.login || user.nip, role: user.role || 'client' },
      process.env.STACK_SECRET_SERVER_KEY,
      { expiresIn: '1h' }
    );

    res.status(200).json({ token, user: { id: user.id, login: user.login || user.nip, role: user.role || 'client' } });

  } catch (error) {
    console.error('API Login Error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}
