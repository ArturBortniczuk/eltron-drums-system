// /api/drums/index.js
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const { method } = req;

  // Middleware do weryfikacji tokenu
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }
  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.STACK_SECRET_SERVER_KEY);
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  switch (method) {
    case 'GET':
      try {
        let drums;
        if (decoded.role === 'admin') {
          // Admin widzi wszystkie bębny
          const { rows } = await sql`SELECT * FROM drums ORDER BY id DESC;`;
          drums = rows;
        } else {
          // Klient widzi tylko swoje bębny (po NIP)
          const { rows } = await sql`
            SELECT * FROM drums WHERE nip = ${decoded.login} ORDER BY id DESC;
          `;
          drums = rows;
        }
        res.status(200).json(drums);
      } catch (error) {
        console.error('API Drums GET Error:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
      }
      break;
      
    case 'POST':
      // Dostępne tylko dla admina
      if (decoded.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }
      try {
        const { kod_bebna, nazwa, nip, data_zwrotu_do_dostawcy, pelna_nazwa_kontrahenta } = req.body;
        if (!kod_bebna || !nip) {
            return res.status(400).json({ message: 'Kod bębna and NIP are required' });
        }
        
        const { rows } = await sql`
          INSERT INTO drums (kod_bebna, nazwa, nip, data_zwrotu_do_dostawcy, pelna_nazwa_kontrahenta) 
          VALUES (${kod_bebna}, ${nazwa}, ${nip}, ${data_zwrotu_do_dostawcy}, ${pelna_nazwa_kontrahenta}) 
          RETURNING *;
        `;
        res.status(201).json(rows[0]);
      } catch (error) {
        console.error('API Drums POST Error:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
      }
      break;

    // Można dodać obsługę PUT i DELETE w podobny sposób
      
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
