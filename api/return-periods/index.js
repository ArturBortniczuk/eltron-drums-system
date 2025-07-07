// /api/return-periods/index.js
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

// Middleware do weryfikacji tokenu admina
const verifyAdmin = (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ message: 'Authorization header missing' });
        return null;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.STACK_SECRET_SERVER_KEY);
        if (decoded.role !== 'admin') {
            res.status(403).json({ message: 'Forbidden' });
            return null;
        }
        return decoded;
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired token' });
        return null;
    }
};


export default async function handler(req, res) {
    const { method } = req;

    if (method !== 'GET') {
        const admin = verifyAdmin(req, res);
        if (!admin) return; // Zakończ, jeśli weryfikacja nie powiodła się
    }

    switch (method) {
        case 'GET':
            try {
                const { rows } = await sql`SELECT * FROM custom_return_periods;`;
                res.status(200).json(rows);
            } catch (error) {
                console.error('API Return Periods GET Error:', error);
                res.status(500).json({ message: 'Internal Server Error', error: error.message });
            }
            break;

        case 'POST':
            try {
                const { drum_type_id, return_period_days } = req.body;
                if (!drum_type_id || !return_period_days) {
                    return res.status(400).json({ message: 'Drum type ID and return period are required' });
                }
                const { rows } = await sql`
                    INSERT INTO custom_return_periods (drum_type_id, return_period_days) 
                    VALUES (${drum_type_id}, ${return_period_days}) 
                    ON CONFLICT (drum_type_id) DO UPDATE SET return_period_days = EXCLUDED.return_period_days
                    RETURNING *;
                `;
                res.status(201).json(rows[0]);
            } catch (error) {
                console.error('API Return Periods POST Error:', error);
                res.status(500).json({ message: 'Internal Server Error', error: error.message });
            }
            break;

        default:
            res.setHeader('Allow', ['GET', 'POST']);
            res.status(405).end(`Method ${method} Not Allowed`);
    }
}
