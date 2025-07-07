// migrate.js
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { companies, drums } = require('./src/data/mockData');
const { adminUsers, clientUsers, returnPeriods } = require('./src/data/additionalData');

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

const createTablesQuery = `
  DROP TABLE IF EXISTS custom_return_periods CASCADE;
  DROP TABLE IF EXISTS return_requests CASCADE;
  DROP TABLE IF EXISTS users CASCADE;
  DROP TABLE IF EXISTS admin_users CASCADE;
  DROP TABLE IF EXISTS drums CASCADE;
  DROP TABLE IF EXISTS companies CASCADE;

  CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    nip VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    status VARCHAR(50)
  );

  CREATE TABLE drums (
    id SERIAL PRIMARY KEY,
    kod_bebna VARCHAR(255) UNIQUE NOT NULL,
    nazwa VARCHAR(255),
    nip VARCHAR(20) REFERENCES companies(nip),
    data_zwrotu_do_dostawcy DATE,
    pelna_nazwa_kontrahenta TEXT
  );

  CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    login VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin'
  );

  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    nip VARCHAR(20) UNIQUE NOT NULL REFERENCES companies(nip),
    password_hash VARCHAR(255) NOT NULL,
    is_first_login BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    company VARCHAR(255)
  );

  CREATE TABLE return_requests (
    id SERIAL PRIMARY KEY,
    drum_id INT REFERENCES drums(id),
    user_id INT REFERENCES users(id),
    request_date TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'pending'
  );

  CREATE TABLE custom_return_periods (
      id SERIAL PRIMARY KEY,
      drum_type_id VARCHAR(255) UNIQUE NOT NULL,
      return_period_days INTEGER NOT NULL
  );
`;

async function migrate() {
  const client = await pool.connect();
  console.log('🟢 Nawiązano połączenie z bazą danych w celu migracji.');

  try {
    await client.query('BEGIN');
    console.log('🟢 Rozpoczęto transakcję.');

    // Krok 1: Tworzenie struktury bazy danych
    console.log('[Krok 1/7] Czyszczenie starej i tworzenie nowej struktury tabel...');
    await client.query(createTablesQuery);
    console.log('✅ [Krok 1/7] Struktura tabel utworzona pomyślnie.');

    console.log('--- Rozpoczęcie wstawiania danych ---');

    // Krok 2: Wstawianie firm
    console.log(`[Krok 2/7] Wstawianie firm (${companies.length})...`);
    for (const company of companies) {
      await client.query(
        'INSERT INTO companies (nip, name, email, phone, address, status) VALUES ($1, $2, $3, $4, $5, $6);',
        [company.nip, company.name, company.email, company.phone, company.address, company.status]
      );
    }
    console.log('✅ [Krok 2/7] Firmy wstawione pomyślnie.');

    // Krok 3: Wstawianie bębnów
    console.log(`[Krok 3/7] Wstawianie bębnów (${drums.length})...`);
    for (const drum of drums) {
      await client.query(
        'INSERT INTO drums (kod_bebna, nazwa, nip, data_zwrotu_do_dostawcy, pelna_nazwa_kontrahenta) VALUES ($1, $2, $3, $4, $5);',
        [drum.kod_bebna, drum.nazwa, drum.nip, drum.data_zwrotu_do_dostawcy, drum.pelna_nazwa_kontrahenta]
      );
    }
    console.log('✅ [Krok 3/7] Bębny wstawione pomyślnie.');

    // Krok 4: Wstawianie użytkowników-administratorów
    console.log(`[Krok 4/7] Wstawianie użytkowników-administratorów (${adminUsers.length})...`);
    for (const user of adminUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await client.query(
        'INSERT INTO admin_users (login, password_hash, role) VALUES ($1, $2, $3);',
        [user.login, hashedPassword, user.role]
      );
    }
    console.log('✅ [Krok 4/7] Użytkownicy-administratorzy wstawieni pomyślnie.');

    // Krok 5: Wstawianie użytkowników-klientów
    console.log(`[Krok 5/7] Wstawianie użytkowników-klientów (${clientUsers.length})...`);
    for (const user of clientUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await client.query(
        'INSERT INTO users (nip, password_hash, company) VALUES ($1, $2, $3);',
        [user.nip, hashedPassword, user.company]
      );
    }
    console.log('✅ [Krok 5/7] Użytkownicy-klienci wstawieni pomyślnie.');
    
    // Krok 6: Wstawianie okresów zwrotów
    console.log(`[Krok 6/7] Wstawianie domyślnych okresów zwrotów (${returnPeriods.length})...`);
    for (const period of returnPeriods) {
        await client.query(
            'INSERT INTO custom_return_periods (drum_type_id, return_period_days) VALUES ($1, $2);',
            [period.drum_type_id, period.return_period_days]
        );
    }
    console.log('✅ [Krok 6/7] Domyślne okresy zwrotów wstawione pomyślnie.');

    await client.query('COMMIT');
    console.log('🎉 [Krok 7/7] Migracja zakończona sukcesem! Zmiany zostały zapisane w bazie danych.');

  } catch (error) {
    console.error('🔴 Całkowita migracja nie powiodła się. Rozpoczynanie wycofywania zmian...');
    await client.query('ROLLBACK');
    console.error('🔴 Zmiany zostały wycofane. Baza danych jest w stanie sprzed migracji.');
    console.error('Szczegółowy błąd, który przerwał migrację:', error.stack);
    process.exit(1);
  } finally {
    console.log('🔵 Zamykanie połączenia z bazą danych.');
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error("Nieobsłużony błąd w funkcji migrate:", err);
  process.exit(1);
});
