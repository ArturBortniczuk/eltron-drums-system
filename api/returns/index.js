// /api/returns/index.js
import { sql } from '@vercel/postgres';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    const { method } = req;

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
                // Admin widzi wszystkie zgłoszenia, klient tylko swoje
                const query = decoded.role === 'admin'
                    ? sql`SELECT rr.*, d.kod_bebna, u.company FROM return_requests rr JOIN drums d ON rr.drum_id = d.id JOIN users u ON rr.user_id = u.id ORDER BY rr.request_date DESC;`
                    : sql`SELECT rr.*, d.kod_bebna FROM return_requests rr JOIN drums d ON rr.drum_id = d.id WHERE rr.user_id = ${decoded.userId} ORDER BY rr.request_date DESC;`;
                
                const { rows } = await query;
                res.status(200).json(rows);
            } catch (error) {
                console.error('API Returns GET Error:', error);
                res.status(500).json({ message: 'Internal Server Error', error: error.message });
            }
            break;

        case 'POST':
            try {
                const { drum_id } = req.body;
                if (!drum_id) {
                    return res.status(400).json({ message: 'Drum ID is required' });
                }

                const { rows } = await sql`
                    INSERT INTO return_requests (drum_id, user_id, status) 
                    VALUES (${drum_id}, ${decoded.userId}, 'pending') 
                    RETURNING *;
                `;
                res.status(201).json(rows[0]);
            } catch (error) {
                console.error('API Returns POST Error:', error);
                res.status(500).json({ message: 'Internal Server Error', error: error.message });
            }
            break;
        
        // Można dodać PUT do zmiany statusu przez admina

        default:
            res.setHeader('Allow', ['GET', 'POST']);
            res.status(405).end(`Method ${method} Not Allowed`);
    }
}
