// migrate.js - Zaktualizowany dla Supabase
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Upewnij się, że zmienne środowiskowe są ładowane
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Konfiguracja połączenia z Supabase
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {
    rejectUnauthorized: false, // Akceptuj certyfikaty Supabase
  },
  // Dodatkowe opcje dla stabilności
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Przykładowe dane dla testów
const companies = [
  { nip: '8513255117', name: 'AS ELECTRIC SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', email: 'kontakt@aselectric.pl', phone: '+48 000 000 000', address: 'Adres do uzupełnienia', status: 'Aktywny' },
  { nip: '6792693162', name: 'PRZEDSIĘBIORSTWO NAPRAW I UTRZYMANIA INFRASTRUKTURY KOLEJOWEJ W KRAKOWIE SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', email: 'kontakt@pniuk.krakow.pl', phone: '+48 000 000 000', address: 'Adres do uzupełnienia', status: 'Aktywny' },
  { nip: '1234567890', name: 'FIRMA TESTOWA SP. Z O.O.', email: 'test@firma.pl', phone: '+48 123 456 789', address: 'ul. Testowa 1, 00-001 Warszawa', status: 'Aktywny' },
  { nip: '9876543210', name: 'KOLEJNA FIRMA SP. Z O.O.', email: 'kontakt@kolejna.pl', phone: '+48 987 654 321', address: 'ul. Kolejna 2, 00-002 Kraków', status: 'Aktywny' },
  { nip: '5555666677', name: 'DEMO COMPANY SP. Z O.O.', email: 'demo@company.pl', phone: '+48 555 666 777', address: 'ul. Demo 3, 00-003 Gdańsk', status: 'Aktywny' }
];

const drums = [
  { kod_bebna: 'B11ELP/ELP', nazwa: 'BĘBEN ELPAR FI 11', nip: '8513255117', data_zwrotu_do_dostawcy: '2026-09-05', pelna_nazwa_kontrahenta: 'AS ELECTRIC SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ' },
  { kod_bebna: 'B10NKT/BEB', nazwa: 'BĘBEN NKT FI 10', nip: '6792693162', data_zwrotu_do_dostawcy: '2025-11-15', pelna_nazwa_kontrahenta: 'PRZEDSIĘBIORSTWO NAPRAW I UTRZYMANIA INFRASTRUKTURY KOLEJOWEJ W KRAKOWIE SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ' },
  { kod_bebna: 'TEST001', nazwa: 'BĘBEN TESTOWY 1', nip: '1234567890', data_zwrotu_do_dostawcy: '2025-12-31', pelna_nazwa_kontrahenta: 'FIRMA TESTOWA SP. Z O.O.' },
  { kod_bebna: 'TEST002', nazwa: 'BĘBEN TESTOWY 2', nip: '1234567890', data_zwrotu_do_dostawcy: '2025-08-15', pelna_nazwa_kontrahenta: 'FIRMA TESTOWA SP. Z O.O.' },
  { kod_bebna: 'DEMO001', nazwa: 'BĘBEN DEMO 1', nip: '5555666677', data_zwrotu_do_dostawcy: '2025-10-01', pelna_nazwa_kontrahenta: 'DEMO COMPANY SP. Z O.O.' }
];

const adminUsers = [
  { login: 'admin', password: 'admin123', role: 'admin' },
  { login: 'supervisor', password: 'super123', role: 'supervisor' }
];

const clientUsers = [
  { nip: '8513255117', password: 'password123', company: 'AS ELECTRIC SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ' },
  { nip: '6792693162', password: 'password123', company: 'PRZEDSIĘBIORSTWO NAPRAW I UTRZYMANIA INFRASTRUKTURY KOLEJOWEJ W KRAKOWIE SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ' },
  { nip: '1234567890', password: 'test123', company: 'FIRMA TESTOWA SP. Z O.O.' },
  { nip: '9876543210', password: 'kolejna123', company: 'KOLEJNA FIRMA SP. Z O.O.' },
  { nip: '5555666677', password: 'demo123', company: 'DEMO COMPANY SP. Z O.O.' }
];

const returnPeriods = [
    { drum_type_id: 'B10', return_period_days: 365 },
    { drum_type_id: 'B11', return_period_days: 400 },
    { drum_type_id: 'default', return_period_days: 85 }
];

const createTablesQuery = `
  -- Usuwanie istniejących tabel (w odpowiedniej kolejności ze względu na foreign keys)
  DROP TABLE IF EXISTS custom_return_periods CASCADE;
  DROP TABLE IF EXISTS return_requests CASCADE;
  DROP TABLE IF EXISTS users CASCADE;
  DROP TABLE IF EXISTS admin_users CASCADE;
  DROP TABLE IF EXISTS drums CASCADE;
  DROP TABLE IF EXISTS companies CASCADE;

  -- Tworzenie tabeli companies
  CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    nip VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    status VARCHAR(50) DEFAULT 'Aktywny',
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Tworzenie tabeli drums
  CREATE TABLE drums (
    id SERIAL PRIMARY KEY,
    kod_bebna VARCHAR(255) UNIQUE NOT NULL,
    nazwa VARCHAR(255),
    cecha TEXT,
    data_zwrotu_do_dostawcy DATE,
    kon_dostawca TEXT,
    pelna_nazwa_kontrahenta TEXT,
    nip VARCHAR(20) REFERENCES companies(nip),
    typ_dok VARCHAR(50),
    nr_dokumentupz VARCHAR(100),
    data_przyjecia_na_stan DATE,
    kontrahent TEXT,
    status VARCHAR(20) DEFAULT 'Aktywny',
    data_wydania DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Tworzenie tabeli admin_users
  CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    nip VARCHAR(10) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    permissions JSONB,
    password_hash TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Tworzenie tabeli users
  CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    nip VARCHAR(20) UNIQUE NOT NULL REFERENCES companies(nip),
    password_hash VARCHAR(255) NOT NULL,
    is_first_login BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    company VARCHAR(255)
  );

  -- Tworzenie tabeli return_requests
  CREATE TABLE return_requests (
    id SERIAL PRIMARY KEY,
    user_nip VARCHAR(20) REFERENCES companies(nip),
    company_name TEXT NOT NULL,
    street TEXT NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    city VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    loading_hours VARCHAR(50) NOT NULL,
    available_equipment TEXT,
    notes TEXT,
    collection_date DATE NOT NULL,
    selected_drums JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending',
    priority VARCHAR(10) DEFAULT 'Normal',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Tworzenie tabeli custom_return_periods
  CREATE TABLE custom_return_periods (
    id SERIAL PRIMARY KEY,
    nip VARCHAR(20) UNIQUE REFERENCES companies(nip),
    return_period_days INTEGER NOT NULL DEFAULT 85,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

async function migrate() {
  const client = await pool.connect();
  console.log('🟢 Nawiązano połączenie z bazą danych Supabase w celu migracji.');

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
        'INSERT INTO admin_users (nip, username, name, email, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6);',
        [
          user.login === 'admin' ? '0000000000' : '1111111111', // Unikalne NIP-y dla adminów
          user.login,
          user.login === 'admin' ? 'Administrator Systemu' : 'Supervisor',
          `${user.login}@grupaeltron.pl`,
          user.role,
          hashedPassword
        ]
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
            'INSERT INTO custom_return_periods (nip, return_period_days) VALUES ($1, $2);',
            ['0000000000', period.return_period_days] // Przypisz do administratora jako domyślne
        );
    }
    console.log('✅ [Krok 6/7] Domyślne okresy zwrotów wstawione pomyślnie.');

    await client.query('COMMIT');
    console.log('🎉 [Krok 7/7] Migracja zakończona sukcesem! Zmiany zostały zapisane w bazie danych Supabase.');

    // Podsumowanie
    console.log('\n📊 PODSUMOWANIE MIGRACJI:');
    console.log(`✅ Firmy: ${companies.length}`);
    console.log(`✅ Bębny: ${drums.length}`);
    console.log(`✅ Administratorzy: ${adminUsers.length}`);
    console.log(`✅ Klienci: ${clientUsers.length}`);
    console.log(`✅ Okresy zwrotów: ${returnPeriods.length}`);
    console.log('\n🔑 DANE TESTOWE:');
    console.log('Administratorzy:');
    console.log('  - NIP: 0000000000, Login: admin, Hasło: admin123');
    console.log('  - NIP: 1111111111, Login: supervisor, Hasło: super123');
    console.log('\nKlienci testowi:');
    clientUsers.forEach(user => {
      console.log(`  - NIP: ${user.nip}, Hasło: ${user.password}`);
    });

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