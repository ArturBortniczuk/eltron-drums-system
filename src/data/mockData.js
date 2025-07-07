// src/data/mockData.js

const companies = [
  // Tutaj wklej całą swoją tablicę 'companies'
  // Przykład:
  { nip: '8513255117', name: 'AS ELECTRIC SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', email: 'kontakt@aselectric.pl', phone: '+48 000 000 000', address: 'Adres do uzupełnienia', status: 'Aktywny' },
  { nip: '6792693162', name: 'PRZEDSIĘBIORSTWO NAPRAW I UTRZYMANIA INFRASTRUKTURY KOLEJOWEJ W KRAKOWIE SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', email: 'kontakt@pniuk.krakow.pl', phone: '+48 000 000 000', address: 'Adres do uzupełnienia', status: 'Aktywny' },
  // ... reszta firm
];

const drums = [
  // Tutaj wklej całą swoją tablicę 'drums'
  // Przykład:
  { kod_bebna: 'B11ELP/ELP', nazwa: 'BĘBEN ELPAR FI 11', nip: '8513255117', data_zwrotu_do_dostawcy: '2026-09-05', pelna_nazwa_kontrahenta: 'AS ELECTRIC SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ' },
  { kod_bebna: 'B10NKT/BEB', nazwa: 'BĘBEN NKT FI 10', nip: '6792693162', data_zwrotu_do_dostawcy: '2025-11-15', pelna_nazwa_kontrahenta: 'PRZEDSIĘBIORSTWO NAPRAW I UTRZYMANIA INFRASTRUKTURY KOLEJOWEJ W KRAKOWIE SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ' },
  // ... reszta bębnów
];

// Używamy module.exports, aby zapewnić kompatybilność z `require` w migrate.js
module.exports = {
  companies,
  drums,
};
