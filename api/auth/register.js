// /api/auth/register.js
// Ten plik obsługuje logikę sprawdzania NIP-u przed logowaniem klienta.

import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  // Zmieniamy endpoint, aby pasował do tego, co wysyła frontend
  // W ustawieniach Vercel (vercel.json) można by to zmapować,
  // ale na razie zakładamy, że plik `register.js` obsługuje tę logikę.
  
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { nip } = req.body;

  if (!nip) {
    return res.status(400).json({ message: 'NIP jest wymagany' });
  }

  try {
    // Sprawdzamy, czy użytkownik (klient) o podanym NIP-ie istnieje w tabeli `users`
    const { rows } = await sql`
      SELECT nip, company FROM users WHERE nip = ${nip};
    `;

    if (rows.length > 0) {
      // Znaleziono użytkownika, NIP jest prawidłowy do logowania
      res.status(200).json({ message: 'NIP prawidłowy', company: rows[0].company });
    } else {
      // Nie znaleziono użytkownika o tym NIP-ie
      res.status(404).json({ message: 'Nie znaleziono zarejestrowanego użytkownika dla tego numeru NIP' });
    }
  } catch (error) {
    console.error('API Check NIP Error:', error);
    res.status(500).json({ message: 'Wewnętrzny błąd serwera', error: error.message });
  }
}
