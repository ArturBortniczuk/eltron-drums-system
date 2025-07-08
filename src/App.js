import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Package, Calendar, LogOut, Search, Filter, FileText, Home, Shield, AlertTriangle, CheckCircle } from 'lucide-react';

const App = () => {
  const [currentView, setCurrentView] = useState('login');
  const [user, setUser] = useState(null);
  const [loginData, setLoginData] = useState({ nip: '', password: '' });
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [drums, setDrums] = useState([]);
  const [filteredDrums, setFilteredDrums] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedDrums, setSelectedDrums] = useState([]);
  const [returnRequest, setReturnRequest] = useState({
    companyName: '',
    street: '',
    postalCode: '',
    city: '',
    email: '',
    loadingHours: '',
    availableEquipment: '',
    notes: '',
    collectionDate: ''
  });

  // Mockowe dane - będą zastąpione danymi z API
  const mockCompanies = {
    '8513255117': 'AS ELECTRIC SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
    '6792693162': 'PRZEDSIĘBIORSTWO NAPRAW I UTRZYMANIA INFRASTRUKTURY KOLEJOWEJ W KRAKOWIE SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
    '5260001336': 'BUDIMEX S.A.',
    '9571010955': 'MOSTOSTAL WARSZAWA S.A.'
  };

  const mockDrumsData = [
    { kod_bebna: 'B11ELP/ELP', nazwa: 'BĘBEN ELPAR FI 11', nip: '8513255117', data_zwrotu_do_dostawcy: '2026-09-05', pelna_nazwa_kontrahenta: 'AS ELECTRIC SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ' },
    { kod_bebna: 'B10NKT/BEB', nazwa: 'BĘBEN NKT FI 10', nip: '6792693162', data_zwrotu_do_dostawcy: '2025-11-15', pelna_nazwa_kontrahenta: 'PRZEDSIĘBIORSTWO NAPRAW I UTRZYMANIA INFRASTRUKTURY KOLEJOWEJ W KRAKOWIE SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ' },
    { kod_bebna: 'B15BUD/001', nazwa: 'BĘBEN BUDIMEX FI 15', nip: '5260001336', data_zwrotu_do_dostawcy: '2025-12-20', pelna_nazwa_kontrahenta: 'BUDIMEX S.A.' },
    { kod_bebna: 'B12MST/WAR', nazwa: 'BĘBEN MOSTOSTAL FI 12', nip: '9571010955', data_zwrotu_do_dostawcy: '2026-01-10', pelna_nazwa_kontrahenta: 'MOSTOSTAL WARSZAWA S.A.' },
    { kod_bebna: 'B11ELP/ELP2', nazwa: 'BĘBEN ELPAR FI 11 V2', nip: '8513255117', data_zwrotu_do_dostawcy: '2025-10-15', pelna_nazwa_kontrahenta: 'AS ELECTRIC SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ' }
  ];

  // Symulacja sprawdzenia pierwszego logowania
  const checkFirstLogin = (nip) => {
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
    return !registeredUsers[nip];
  };

  // Logowanie
  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      if (loginData.nip && mockCompanies[loginData.nip]) {
        const isFirst = checkFirstLogin(loginData.nip);
        
        if (isFirst) {
          setIsFirstLogin(true);
          setUser({
            nip: loginData.nip,
            companyName: mockCompanies[loginData.nip]
          });
        } else {
          const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
          if (registeredUsers[loginData.nip] === loginData.password) {
            setUser({
              nip: loginData.nip,
              companyName: mockCompanies[loginData.nip]
            });
            setCurrentView('dashboard');
            loadUserDrums(loginData.nip);
          } else {
            setError('Nieprawidłowe hasło');
          }
        }
      } else {
        setError('Nie znaleziono firmy o podanym NIP');
      }
      setLoading(false);
    }, 1000);
  };

  // Ustawianie hasła przy pierwszym logowaniu
  const handleSetPassword = (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Hasła nie są identyczne');
      return;
    }

    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
    registeredUsers[user.nip] = newPassword;
    localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));

    setIsFirstLogin(false);
    setCurrentView('dashboard');
    loadUserDrums(user.nip);
  };

  // Ładowanie bębnów użytkownika
  const loadUserDrums = (nip) => {
    const userDrums = mockDrumsData.filter(drum => drum.nip === nip);
    setDrums(userDrums);
    setFilteredDrums(userDrums);
  };

  // Filtrowanie bębnów
  useEffect(() => {
    if (searchTerm) {
      const filtered = drums.filter(drum => 
        drum.kod_bebna.toLowerCase().includes(searchTerm.toLowerCase()) ||
        drum.nazwa.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredDrums(filtered);
    } else {
      setFilteredDrums(drums);
    }
  }, [searchTerm, drums]);

  // Formatowanie daty
  const formatDate = (dateString) => {
    if (!dateString) return 'Brak daty';
    return new Date(dateString).toLocaleDateString('pl-PL');
  };

  // Sprawdzenie czy data zwrotu jest bliska
  const isReturnDateNear = (dateString) => {
    if (!dateString) return false;
    const returnDate = new Date(dateString);
    const today = new Date();
    const diffTime = returnDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays >= 0;
  };

  // Obsługa wyboru bębnów do zwrotu
  const handleDrumSelection = (drumId, checked) => {
    if (checked) {
      setSelectedDrums([...selectedDrums, drumId]);
    } else {
      setSelectedDrums(selectedDrums.filter(id => id !== drumId));
    }
  };

  // Składanie wniosku o zwrot
  const handleReturnSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (selectedDrums.length === 0) {
      setError('Wybierz co najmniej jeden bęben do zwrotu');
      return;
    }

    // Tutaj będzie API call
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setCurrentView('dashboard');
      setSelectedDrums([]);
      setReturnRequest({
        companyName: '',
        street: '',
        postalCode: '',
        city: '',
        email: '',
        loadingHours: '',
        availableEquipment: '',
        notes: '',
        collectionDate: ''
      });
      alert('Wniosek o zwrot został złożony pomyślnie!');
    }, 1500);
  };

  // Wylogowanie
  const handleLogout = () => {
    setUser(null);
    setCurrentView('login');
    setLoginData({ nip: '', password: '' });
    setDrums([]);
    setFilteredDrums([]);
    setSelectedDrums([]);
    setError('');
  };

  // Ekran logowania
  if (currentView === 'login' && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">System Bębnów</h1>
            <p className="text-gray-600 mt-2">Grupa Eltron</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">NIP Firmy</label>
              <input
                type="text"
                value={loginData.nip}
                onChange={(e) => setLoginData({...loginData, nip: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Wprowadź NIP firmy"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hasło</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={loginData.password}
                  onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                  placeholder="Wprowadź hasło"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Zaloguj się'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Po pierwszym logowaniu zostaniesz poproszony o ustawienie hasła
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Ekran ustawiania hasła przy pierwszym logowaniu
  if (isFirstLogin && user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Pierwsze logowanie</h1>
            <p className="text-gray-600 mt-2">Ustaw swoje hasło</p>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 font-medium">{user.companyName}</p>
            </div>
          </div>

          <form onSubmit={handleSetPassword} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nowe hasło</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent pr-10"
                  placeholder="Co najmniej 6 znaków"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Potwierdź hasło</label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Powtórz hasło"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
            >
              <Shield className="w-5 h-5 mr-2" />
              Ustaw hasło
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Dashboard
  if (currentView === 'dashboard' && user) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-semibold text-gray-900">System Bębnów</h1>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user.companyName}</p>
                  <p className="text-xs text-gray-500">NIP: {user.nip}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  currentView === 'dashboard' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Home className="w-4 h-4 inline mr-2" />
                Moje Bębny
              </button>
              <button
                onClick={() => setCurrentView('return')}
                className={`py-4 px-2 border-b-2 font-medium text-sm ${
                  currentView === 'return' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Wniosek o Zwrot
              </button>
            </div>
          </div>
        </nav>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Dashboard View */}
          {currentView === 'dashboard' && (
            <div>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Wszystkie Bębny</p>
                      <p className="text-2xl font-bold text-gray-900">{drums.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Bliskie Zwrotu</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {drums.filter(drum => isReturnDateNear(drum.data_zwrotu_do_dostawcy)).length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Aktywne</p>
                      <p className="text-2xl font-bold text-gray-900">{drums.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search and Filter */}
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Szukaj bębnów po kodzie lub nazwie..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <button className="flex items-center px-6 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                    <Filter className="w-5 h-5 mr-2" />
                    Filtruj
                  </button>
                </div>
              </div>

              {/* Drums List */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Lista Bębnów</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Kod Bębna
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nazwa
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Data Zwrotu
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredDrums.map((drum, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{drum.kod_bebna}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{drum.nazwa}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                              <span className={`text-sm ${isReturnDateNear(drum.data_zwrotu_do_dostawcy) ? 'text-yellow-600 font-medium' : 'text-gray-900'}`}>
                                {formatDate(drum.data_zwrotu_do_dostawcy)}
                              </span>
                              {isReturnDateNear(drum.data_zwrotu_do_dostawcy) && (
                                <AlertTriangle className="w-4 h-4 text-yellow-500 ml-2" />
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Aktywny
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {filteredDrums.length === 0 && (
                  <div className="text-center py-12">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Brak bębnów</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {searchTerm ? 'Nie znaleziono bębnów pasujących do wyszukiwania' : 'Nie masz jeszcze żadnych bębnów'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Return Request View */}
          {currentView === 'return' && (
            <div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Wniosek o Zwrot Bębnów</h2>
                <p className="text-gray-600 mt-2">Wybierz bębny do zwrotu i wypełnij dane logistyczne</p>
              </div>

              <form onSubmit={handleReturnSubmit} className="space-y-8">
                {/* Drums Selection */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Wybierz Bębny do Zwrotu</h3>
                  <div className="space-y-4">
                    {drums.map((drum, index) => (
                      <div key={index} className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                        <input
                          type="checkbox"
                          id={`drum-${index}`}
                          checked={selectedDrums.includes(drum.kod_bebna)}
                          onChange={(e) => handleDrumSelection(drum.kod_bebna, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`drum-${index}`} className="ml-3 flex-1 cursor-pointer">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{drum.kod_bebna}</p>
                              <p className="text-sm text-gray-500">{drum.nazwa}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-900">Data zwrotu: {formatDate(drum.data_zwrotu_do_dostawcy)}</p>
                              {isReturnDateNear(drum.data_zwrotu_do_dostawcy) && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Bliski zwrot
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                  
                  {selectedDrums.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700">
                        Wybrano {selectedDrums.length} bębnów do zwrotu
                      </p>
                    </div>
                  )}
                </div>

                {/* Company Information */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Dane Firmy</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nazwa Firmy</label>
                      <input
                        type="text"
                        value={returnRequest.companyName}
                        onChange={(e) => setReturnRequest({...returnRequest, companyName: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nazwa firmy"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Kontaktowy</label>
                      <input
                        type="email"
                        value={returnRequest.email}
                        onChange={(e) => setReturnRequest({...returnRequest, email: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="email@firma.pl"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Adres Odbioru</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Ulica i Numer</label>
                      <input
                        type="text"
                        value={returnRequest.street}
                        onChange={(e) => setReturnRequest({...returnRequest, street: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="ul. Przykładowa 123"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Kod Pocztowy</label>
                      <input
                        type="text"
                        value={returnRequest.postalCode}
                        onChange={(e) => setReturnRequest({...returnRequest, postalCode: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="00-000"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Miasto</label>
                      <input
                        type="text"
                        value={returnRequest.city}
                        onChange={(e) => setReturnRequest({...returnRequest, city: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Warszawa"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Logistics Information */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Informacje Logistyczne</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Data Odbioru</label>
                      <input
                        type="date"
                        value={returnRequest.collectionDate}
                        onChange={(e) => setReturnRequest({...returnRequest, collectionDate: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Godziny Załadunku</label>
                      <input
                        type="text"
                        value={returnRequest.loadingHours}
                        onChange={(e) => setReturnRequest({...returnRequest, loadingHours: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="08:00 - 16:00"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Dostępny Sprzęt</label>
                      <input
                        type="text"
                        value={returnRequest.availableEquipment}
                        onChange={(e) => setReturnRequest({...returnRequest, availableEquipment: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Dźwig, wózek widłowy, etc."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Uwagi Dodatkowe</label>
                      <textarea
                        value={returnRequest.notes}
                        onChange={(e) => setReturnRequest({...returnRequest, notes: e.target.value})}
                        rows={4}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Dodatkowe informacje dotyczące odbioru..."
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setCurrentView('dashboard')}
                    className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={loading || selectedDrums.length === 0}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Składanie wniosku...
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5 mr-2" />
                        Złóż Wniosek o Zwrot
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    );
  }

  return null;
};

export default App;
