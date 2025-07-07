// /api/health.js

import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    // Proste zapytanie do bazy, aby sprawdzić połączenie
    await sql`SELECT 1;`;
    
    // Sprawdź, czy istnieją kluczowe tabele
    const companiesCheck = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies');`;
    const usersCheck = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users');`;

    if (!companiesCheck.rows[0].exists || !usersCheck.rows[0].exists) {
        throw new Error('Required tables are missing.');
    }

    res.status(200).json({ status: 'healthy', database: 'connected and schema valid' });
  } catch (error) {
    console.error('Health Check Error:', error);
    res.status(500).json({ status: 'unhealthy', database: 'disconnected or schema invalid', error: error.message });
  }
}
