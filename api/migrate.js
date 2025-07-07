// migrate.js
const { Pool } = require('pg');
const { companies, drums } = require('./src/data/mockData');
const { adminUsers, clientUsers, returnPeriods } = require('./src/data/additionalData');
const bcrypt = require('bcryptjs');

// Upewnij się, że zmienna środowiskowa jest ładowana
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function migrate() {
  const client = await pool.connect();
  console.log('Nawiązano połączenie z bazą danych w celu migracji.');

  try {
    await client.query('BEGIN');
    console.log('Rozpoczęto transakcję.');

    // Tworzenie tabel (zakładamy, że ten fragment jest poprawny i istnieje w Twoim pliku)
    // ... Twoje zapytania CREATE TABLE ...
    console.log('Struktura tabel zweryfikowana/utworzona.');

    console.log('--- Rozpoczęcie wstawiania danych ---');

    // Krok 1: Wstawianie firm
    try {
      console.log('[Krok 1/5] Wstawianie firm...');
      for (const company of companies) {
        await client.query(
          'INSERT INTO companies (nip, name, email, phone, address, status) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (nip) DO NOTHING;',
          [company.nip, company.name, company.email, company.phone, company.address, company.status]
        );
      }
      console.log('✅ [Krok 1/5] Firmy wstawione pomyślnie.');
    } catch (error) {
      console.error('❌ BŁĄD podczas wstawiania firm:', error);
      throw error; // Zatrzymaj migrację i wycofaj transakcję
    }

    // Krok 2: Wstawianie bębnów
    try {
      console.log('[Krok 2/5] Wstawianie bębnów...');
      for (const drum of drums) {
        await client.query(
          'INSERT INTO drums (kod_bebna, nazwa, nip, data_zwrotu_do_dostawcy, pelna_nazwa_kontrahenta) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (kod_bebna) DO NOTHING;',
          [drum.kod_bebna, drum.nazwa, drum.nip, drum.data_zwrotu_do_dostawcy, drum.pelna_nazwa_kontrahenta]
        );
      }
      console.log('✅ [Krok 2/5] Bębny wstawione pomyślnie.');
    } catch (error) {
      console.error('❌ BŁĄD podczas wstawiania bębnów:', error);
      throw error;
    }

    // Krok 3: Wstawianie użytkowników-administratorów
    try {
      console.log('[Krok 3/5] Wstawianie użytkowników-administratorów...');
      for (const user of adminUsers) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await client.query(
          'INSERT INTO admin_users (login, password_hash, role) VALUES ($1, $2, $3) ON CONFLICT (login) DO NOTHING;',
          [user.login, hashedPassword, user.role]
        );
      }
      console.log('✅ [Krok 3/5] Użytkownicy-administratorzy wstawieni pomyślnie.');
    } catch (error) {
      console.error('❌ BŁĄD podczas wstawiania użytkowników-administratorów:', error);
      throw error;
    }

    // Krok 4: Wstawianie użytkowników-klientów
    try {
      console.log('[Krok 4/5] Wstawianie użytkowników-klientów...');
      for (const user of clientUsers) {
        console.log(`-- Próba wstawienia użytkownika z NIP: ${user.nip} i nazwą firmy: ${user.company}`);
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await client.query(
          'INSERT INTO users (nip, password_hash, company) VALUES ($1, $2, $3) ON CONFLICT (nip) DO NOTHING;',
          [user.nip, hashedPassword, user.company]
        );
      }
      console.log('✅ [Krok 4/5] Użytkownicy-klienci wstawieni pomyślnie.');
    } catch (error) {
      console.error('❌ BŁĄD podczas wstawiania użytkowników-klientów:', error);
      throw error;
    }
    
    // Krok 5: Wstawianie okresów zwrotów
    try {
        console.log('[Krok 5/5] Wstawianie domyślnych okresów zwrotów...');
        for (const period of returnPeriods) {
            await client.query(
                'INSERT INTO custom_return_periods (drum_type_id, return_period_days) VALUES ($1, $2) ON CONFLICT (drum_type_id) DO NOTHING;',
                [period.drum_type_id, period.return_period_days]
            );
        }
        console.log('✅ [Krok 5/5] Domyślne okresy zwrotów wstawione pomyślnie.');
    } catch (error) {
        console.error('❌ BŁĄD podczas wstawiania domyślnych okresów zwrotów:', error);
        throw error;
    }


    await client.query('COMMIT');
    console.log('🎉 Migracja zakończona sukcesem! Zmiany zostały zapisane w bazie danych.');

  } catch (error) {
    console.error('🔴 Całkowita migracja nie powiodła się. Rozpoczynanie wycofywania zmian...');
    await client.query('ROLLBACK');
    console.error('🔴 Zmiany zostały wycofane. Baza danych jest w stanie sprzed migracji.');
    console.error('Szczegółowy błąd, który przerwał migrację:', error.stack);
    process.exit(1); // Zakończ proces z kodem błędu, aby zasygnalizować problem w Vercel
  } finally {
    console.log('Zamykanie połączenia z bazą danych.');
    client.release();
    pool.end();
  }
}

migrate().catch(err => {
  console.error("Nieobsłużony błąd w funkcji migrate:", err);
  process.exit(1);
});
