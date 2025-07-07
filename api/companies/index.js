// /api/companies/index.js
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const { method } = req;

  // Tylko admin może zarządzać firmami
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header missing' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.STACK_SECRET_SERVER_KEY);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  switch (method) {
    case 'GET':
      try {
        const { rows } = await sql`SELECT * FROM companies ORDER BY name ASC;`;
        res.status(200).json(rows);
      } catch (error) {
        console.error('API Companies GET Error:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
      }
      break;

    // Można dodać obsługę POST, PUT, DELETE dla admina

    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
