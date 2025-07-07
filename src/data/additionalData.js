// src/data/additionalData.js

const adminUsers = [
  { login: 'admin', password: 'adminpassword', role: 'admin' },
  // Możesz dodać więcej administratorów
];

const clientUsers = [
  // Upewnij się, że każdy NIP istnieje w pliku mockData.js w tabeli 'companies'
  { nip: '8513255117', password: 'password123', company: 'AS ELECTRIC SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ' },
  { nip: '6792693162', password: 'password123', company: 'PRZEDSIĘBIORSTWO NAPRAW I UTRZYMANIA INFRASTRUKTURY KOLEJOWEJ W KRAKOWIE SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ' },
  // ... reszta użytkowników-klientów
];

const returnPeriods = [
    { drum_type_id: 'B10', return_period_days: 365 },
    { drum_type_id: 'B11', return_period_days: 400 },
    { drum_type_id: 'default', return_period_days: 180 },
    // ... reszta okresów zwrotu
];


// Używamy module.exports
module.exports = {
  adminUsers,
  clientUsers,
  returnPeriods,
};
