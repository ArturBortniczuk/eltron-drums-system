// /api/health.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    // Proste zapytanie do bazy, aby sprawdzić połączenie
    await sql`SELECT 1;`;
    res.status(200).json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    console.error('Health Check Error:', error);
    res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: error.message });
  }
}
