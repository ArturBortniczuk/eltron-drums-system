import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { Eye, EyeOff, Building2, Shield, CheckCircle, ArrowRight, UserCheck, Wifi, WifiOff, Package, Truck, Calendar, TrendingUp, AlertCircle, Clock, BarChart3, Activity, RefreshCw, Download, Users, Filter, ArrowUpDown, MoreVertical, Edit, Trash2, Home, LogOut, ChevronRight, MapPin, Mail, Phone, Plus, RotateCcw, Info, Settings, Bell, Search, Crown, X, Menu, MessageSquare, Send } from 'lucide-react';

// =================================================================
// 1. PLIK KONFIGURACYJNY API (src/utils/api.js)
// =================================================================
// UWAGA: Ta część kodu jest odpowiednikiem Twojego pliku src/utils/api.js
// Została umieszczona tutaj dla kompletności.

const API_BASE_URL = process.env.REACT_APP_API_URL || '';
const USE_MOCK_DATA = process.env.REACT_APP_USE_MOCK_DATA === 'true';

const getAuthToken = () => localStorage.getItem('authToken');

const makeRequest = async (url, options = {}) => {
  if (USE_MOCK_DATA) {
    console.warn(`MOCK API CALL: ${url}`);
    // Zwróć puste dane dla trybu mock, aby wymusić korzystanie z API
    return []; 
  }

  const token = getAuthToken();
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, config);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Błąd sieci lub nieprawidłowa odpowiedź JSON' }));
    throw new Error(errorData.error || `Błąd HTTP ${response.status}`);
  }

  // Obsługa pustej odpowiedzi (np. status 204)
  if (response.status === 204) {
    return null;
  }

  return response.json();
};

export const authAPI = {
  async login(nip, password, loginMode = 'client') {
    const response = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ nip, password, loginMode }),
    });
    if (response && response.token && response.user) {
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('currentUser', JSON.stringify(response.user));
    }
    return response;
  },
  async register(nip, password, confirmPassword, loginMode = 'client') {
    const response = await makeRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ nip, password, confirmPassword, loginMode }),
    });
    if (response && response.token && response.user) {
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('currentUser', JSON.stringify(response.user));
    }
    return response;
  },
  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
  },
  getCurrentUser: () => {
    try {
      return JSON.parse(localStorage.getItem('currentUser'));
    } catch {
      return null;
    }
  },
  isAuthenticated: () => !!getAuthToken(),
};

export const drumsAPI = {
  getDrums: (nip = null) => makeRequest(nip ? `/api/drums?nip=${nip}` : '/api/drums'),
};

export const companiesAPI = {
  getCompanies: () => makeRequest('/api/companies'),
  getCompany: (nip) => makeRequest(`/api/companies?nip=${nip}`),
  updateCompany: (nip, data) => makeRequest(`/api/companies?nip=${nip}`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const returnsAPI = {
  getReturns: (nip = null) => makeRequest(nip ? `/api/returns?nip=${nip}` : '/api/returns'),
  createReturn: (returnData) => makeRequest('/api/returns', { method: 'POST', body: JSON.stringify(returnData) }),
  updateReturnStatus: (id, status) => makeRequest(`/api/returns?id=${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
};

export const returnPeriodsAPI = {
  getReturnPeriods: () => makeRequest('/api/return-periods'),
  updateReturnPeriod: (nip, returnPeriodDays) => makeRequest(`/api/return-periods?nip=${nip}`, { method: 'PUT', body: JSON.stringify({ returnPeriodDays }) }),
  resetReturnPeriod: (nip) => makeRequest(`/api/return-periods?nip=${nip}`, { method: 'DELETE' }),
};


export const handleAPIError = (error, setErrorCallback) => {
  console.error("Błąd API:", error);
  const message = error.message || "Wystąpił nieznany błąd.";
  if (setErrorCallback) {
    setErrorCallback(message);
  }
  return message;
};

// =================================================================
// 2. KOMPONENTY APLIKACJI (z folderu src/components)
// =================================================================

const LoadingComponent = ({ message = "Ładowanie..." }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center">
    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
    <p className="text-lg font-semibold text-gray-700">{message}</p>
  </div>
);

const ErrorComponent = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center bg-red-50 rounded-lg border border-red-200">
    <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
    <p className="text-lg font-semibold text-red-700 mb-2">Wystąpił błąd</p>
    <p className="text-gray-600 mb-6">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
      >
        Spróbuj ponownie
      </button>
    )}
  </div>
);

// --- Komponenty Klienta ---

const Dashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState({ totalDrums: 0, overdueDrums: 0, dueSoon: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user?.nip) return;
    try {
      setLoading(true);
      setError(null);
      const drums = await drumsAPI.getDrums();
      const now = new Date();
      
      const overdueDrums = drums.filter(d => new Date(d.data_zwrotu_do_dostawcy) < now).length;
      const dueSoon = drums.filter(d => {
        const returnDate = new Date(d.data_zwrotu_do_dostawcy);
        const diffDays = (returnDate - now) / (1000 * 60 * 60 * 24);
        return diffDays > 0 && diffDays <= 7;
      }).length;

      setStats({ totalDrums: drums.length, overdueDrums, dueSoon });
    } catch (err) {
      handleAPIError(err, setError);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) return <LoadingComponent message="Ładowanie panelu..." />;
  if (error) return <ErrorComponent message={error} onRetry={fetchDashboardData} />;

  const StatCard = ({ icon: Icon, title, value, color, actionText, action }) => (
    <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-blue-100 hover:shadow-xl transition-all duration-300">
      <div className="flex items-center space-x-4">
        <div className={`p-3 rounded-xl ${color} bg-opacity-10`}><Icon className={`w-6 h-6 ${color}`} /></div>
        <div>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-600">{title}</p>
        </div>
      </div>
      <button onClick={action} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-800 flex items-center">
        {actionText} <ArrowRight className="w-4 h-4 ml-1" />
      </button>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Witaj, {user.companyName}!</h1>
        <p className="text-gray-600">Oto podsumowanie Twojego konta.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard icon={Package} title="Wszystkie bębny" value={stats.totalDrums} color="text-blue-600" actionText="Zobacz listę" action={() => onNavigate('drums')} />
        <StatCard icon={AlertCircle} title="Przeterminowane" value={stats.overdueDrums} color="text-red-600" actionText="Zgłoś zwrot" action={() => onNavigate('return')} />
        <StatCard icon={Clock} title="Zbliża się termin" value={stats.dueSoon} color="text-yellow-600" actionText="Sprawdź bębny" action={() => onNavigate('drums')} />
      </div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-blue-100">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Szybkie Akcje</h2>
            <div className="space-y-4">
                <button onClick={() => onNavigate('drums')} className="w-full text-left p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                    <p className="font-semibold text-blue-800">Zobacz moje bębny</p>
                    <p className="text-sm text-blue-600">Przeglądaj listę wszystkich swoich bębnów i ich statusy.</p>
                </button>
                <button onClick={() => onNavigate('return')} className="w-full text-left p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                    <p className="font-semibold text-green-800">Zgłoś zwrot bębnów</p>
                    <p className="text-sm text-green-600">Wypełnij formularz, aby zaplanować odbiór pustych bębnów.</p>
                </button>
            </div>
         </div>
       </div>
    </div>
  );
};

const DrumsList = ({ user, onNavigate }) => {
    // Implementacja pobierania danych z API dla listy bębnów klienta
    const [drums, setDrums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchDrums = useCallback(async () => {
        if (!user?.nip) return;
        try {
            setLoading(true);
            setError(null);
            const data = await drumsAPI.getDrums();
            setDrums(data || []);
        } catch (err) {
            handleAPIError(err, setError);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchDrums();
    }, [fetchDrums]);

    if (loading) return <LoadingComponent message="Ładowanie listy bębnów..." />;
    if (error) return <ErrorComponent message={error} onRetry={fetchDrums} />;

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Twoje bębny</h1>
            {drums.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {drums.map(drum => (
                        <div key={drum.id || drum.kod_bebna} className="bg-white p-6 rounded-lg shadow-md border">
                            <h2 className="text-lg font-bold">{drum.kod_bebna}</h2>
                            <p className="text-gray-600">{drum.nazwa}</p>
                            <p className="text-sm mt-2">Termin zwrotu: <span className="font-semibold">{new Date(drum.data_zwrotu_do_dostawcy).toLocaleDateString('pl-PL')}</span></p>
                             <button onClick={() => onNavigate('return', drum)} className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
                                Zgłoś zwrot
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p>Nie masz aktualnie żadnych bębnów.</p>
            )}
        </div>
    );
};

const ReturnForm = ({ user, selectedDrum, onNavigate, onSubmit }) => {
    // Implementacja formularza zwrotu, może pobierać listę bębnów do wyboru
    const [userDrums, setUserDrums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        collectionDate: new Date().toISOString().split('T')[0],
        street: '',
        postalCode: '',
        city: '',
        email: '',
        loadingHours: '',
        notes: '',
        selectedDrums: selectedDrum ? [selectedDrum.kod_bebna] : [],
    });

    const fetchUserDrums = useCallback(async () => {
        if (!user?.nip) return;
        try {
            setLoading(true);
            setError(null);
            const data = await drumsAPI.getDrums();
            setUserDrums(data || []);
        } catch (err) {
            handleAPIError(err, setError);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchUserDrums();
    }, [fetchUserDrums]);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await returnsAPI.createReturn({
                ...formData,
                companyName: user.companyName,
            });
            onSubmit(); // Wywołaj funkcję zwrotną po sukcesie
        } catch (err) {
            handleAPIError(err, setError);
        } finally {
            setLoading(false);
        }
    };

    const handleDrumToggle = (drumCode) => {
        setFormData(prev => ({
            ...prev,
            selectedDrums: prev.selectedDrums.includes(drumCode)
                ? prev.selectedDrums.filter(code => code !== drumCode)
                : [...prev.selectedDrums, drumCode]
        }));
    };
    
    // ... reszta logiki formularza
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Zgłoszenie zwrotu</h1>
            {error && <p className="text-red-500">{error}</p>}
            
            <div>
                <label className="block text-sm font-medium text-gray-700">Wybierz bębny do zwrotu</label>
                {loading ? <p>Ładowanie bębnów...</p> : (
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                        {userDrums.map(drum => (
                            <div key={drum.id || drum.kod_bebna} className="border p-2 rounded-md">
                                <label className="flex items-center space-x-2">
                                    <input 
                                        type="checkbox"
                                        checked={formData.selectedDrums.includes(drum.kod_bebna)}
                                        onChange={() => handleDrumToggle(drum.kod_bebna)}
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                    />
                                    <span>{drum.kod_bebna}</span>
                                </label>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pozostałe pola formularza */}
            <div>
                <label htmlFor="collectionDate" className="block text-sm font-medium text-gray-700">Preferowana data odbioru</label>
                <input type="date" id="collectionDate" value={formData.collectionDate} onChange={e => setFormData({...formData, collectionDate: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
            </div>
            <div>
                <label htmlFor="street" className="block text-sm font-medium text-gray-700">Ulica i numer</label>
                <input type="text" id="street" value={formData.street} onChange={e => setFormData({...formData, street: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm" required />
            </div>
            {/* ... inne pola ... */}

            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                {loading ? 'Wysyłanie...' : 'Wyślij zgłoszenie'}
            </button>
        </form>
    );
};

// --- Komponenty Admina ---

const AdminDashboard = ({ onNavigate }) => {
    // Implementacja pobierania danych z API dla dashboardu admina
    return <div>Admin Dashboard - do implementacji</div>;
};

const AdminClientsList = ({ onNavigate }) => {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchClients = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await companiesAPI.getCompanies();
            setClients(data || []);
        } catch (err) {
            handleAPIError(err, setError);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    if (loading) return <LoadingComponent message="Ładowanie listy klientów..." />;
    if (error) return <ErrorComponent message={error} onRetry={fetchClients} />;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Zarządzanie klientami</h1>
                <button onClick={fetchClients} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>
            {clients.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.map(client => (
                        <div key={client.id || client.nip} className="bg-white p-6 rounded-lg shadow-md border">
                            <h2 className="text-lg font-bold">{client.name}</h2>
                            <p className="text-gray-600">NIP: {client.nip}</p>
                            <p className="text-sm mt-2">Liczba bębnów: <span className="font-semibold">{client.drums_count || 0}</span></p>
                            <p className="text-sm">Przeterminowane: <span className="font-semibold text-red-600">{client.overdue_drums || 0}</span></p>
                        </div>
                    ))}
                </div>
            ) : (
                <p>Brak klientów w bazie danych.</p>
            )}
        </div>
    );
};


const AdminDrumsList = ({ onNavigate }) => {
    // Implementacja pobierania danych z API dla listy wszystkich bębnów
    return <div>Admin Drums List - do implementacji</div>;
};

const AdminReturnRequests = ({ onNavigate }) => {
    // Implementacja pobierania danych z API dla zgłoszeń zwrotów
    return <div>Admin Return Requests - do implementacji</div>;
};

const AdminReports = ({ onNavigate }) => {
    // Implementacja pobierania danych z API dla raportów
    return <div>Admin Reports - do implementacji</div>;
};

const AdminReturnPeriodsManager = ({ onNavigate }) => {
    // Implementacja pobierania danych z API dla zarządzania terminami zwrotu
    return <div>Admin Return Periods Manager - do implementacji</div>;
};


// --- Komponenty wspólne ---

const Navbar = ({ user, currentView, onNavigate, onLogout, setSidebarOpen, sidebarOpen }) => (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-blue-100 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
                <div className="flex items-center space-x-4">
                    <button onClick={() => setSidebarOpen(prev => !prev)} className="p-2 rounded-lg text-gray-600 hover:bg-blue-50">
                        <Menu className="w-6 h-6" />
                    </button>
                    <h1 className="text-lg font-bold text-blue-700">Eltron Drums</h1>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium">{user.companyName}</span>
                    <button onClick={onLogout} className="p-2 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
        {/* Tutaj można dodać logikę wysuwanego menu (sidebar) */}
    </header>
);

const AdminNavbar = ({ user, currentView, onNavigate, onLogout, setSidebarOpen, sidebarOpen }) => (
     <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-purple-100 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
                <div className="flex items-center space-x-4">
                    <button onClick={() => setSidebarOpen(prev => !prev)} className="p-2 rounded-lg text-gray-600 hover:bg-purple-50">
                        <Menu className="w-6 h-6" />
                    </button>
                    <h1 className="text-lg font-bold text-purple-700">Eltron Drums - Panel Admina</h1>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium">{user.name}</span>
                    <button onClick={onLogout} className="p-2 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
        {/* Tutaj można dodać logikę wysuwanego menu (sidebar) dla admina */}
    </header>
);

const LoginForm = ({ onLogin }) => {
    const [nip, setNip] = useState('');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isFirstLogin, setIsFirstLogin] = useState(false);
    const [loginMode, setLoginMode] = useState('client');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            let response;
            if (isFirstLogin) {
                response = await authAPI.register(nip, newPassword, confirmPassword, loginMode);
            } else {
                response = await authAPI.login(nip, password, loginMode);
            }

            if (response.firstLogin) {
                setIsFirstLogin(true);
            } else if (response.user) {
                onLogin(response.user);
            }
        } catch (err) {
            handleAPIError(err, setError);
        } finally {
            setLoading(false);
        }
    };
    
    // ... reszta logiki formularza logowania
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full space-y-8 p-10 bg-white shadow-lg rounded-xl">
                <h2 className="text-center text-3xl font-extrabold text-gray-900">
                    Zaloguj się do systemu
                </h2>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {/* ... pola NIP, hasła, etc. ... */}
                    <input name="nip" type="text" value={nip} onChange={e => setNip(e.target.value)} required className="... w-full" placeholder="NIP" />
                    {!isFirstLogin ? (
                        <input name="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="... w-full" placeholder="Hasło" />
                    ) : (
                        <>
                            <input name="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="... w-full" placeholder="Nowe hasło" />
                            <input name="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="... w-full" placeholder="Potwierdź hasło" />
                        </>
                    )}
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button type="submit" disabled={loading} className="... w-full">
                        {loading ? 'Logowanie...' : (isFirstLogin ? 'Ustaw hasło i zaloguj' : 'Zaloguj')}
                    </button>
                </form>
            </div>
        </div>
    );
};


// =================================================================
// 3. GŁÓWNY KOMPONENT APLIKACJI (App.js)
// =================================================================

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedDrum, setSelectedDrum] = useState(null);
  const [navigationData, setNavigationData] = useState(null);

  useEffect(() => {
    const user = authAPI.getCurrentUser();
    if (user && authAPI.isAuthenticated()) {
      setCurrentUser(user);
      const defaultView = (user.role === 'admin' || user.role === 'supervisor') ? 'admin-dashboard' : 'dashboard';
      setCurrentView(defaultView);
    }
    setLoading(false);
  }, []);

  const handleLogin = useCallback((user) => {
    setCurrentUser(user);
    const defaultView = (user.role === 'admin' || user.role === 'supervisor') ? 'admin-dashboard' : 'dashboard';
    setCurrentView(defaultView);
  }, []);

  const handleLogout = useCallback(() => {
    authAPI.logout();
    setCurrentUser(null);
    setCurrentView('login');
  }, []);

  const navigateTo = useCallback((view, data = null) => {
    setCurrentView(view);
    if (data && data.drum) setSelectedDrum(data.drum);
    if (data && data.navigationData) setNavigationData(data.navigationData);
    if (data && typeof data === 'object' && data.KOD_BEBNA) setSelectedDrum(data);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  }, []);

  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'supervisor');

  const renderView = () => {
    if (!currentUser) {
      return <LoginForm onLogin={handleLogin} />;
    }
    switch (currentView) {
      // Widoki klienta
      case 'dashboard': return <Dashboard user={currentUser} onNavigate={navigateTo} />;
      case 'drums': return <DrumsList user={currentUser} onNavigate={navigateTo} />;
      case 'return': return <ReturnForm user={currentUser} selectedDrum={selectedDrum} onNavigate={navigateTo} onSubmit={() => navigateTo('dashboard')} />;
      
      // Widoki admina
      case 'admin-dashboard': return <AdminDashboard user={currentUser} onNavigate={navigateTo} />;
      case 'admin-clients': return <AdminClientsList user={currentUser} onNavigate={navigateTo} />;
      case 'admin-drums': return <AdminDrumsList user={currentUser} onNavigate={navigateTo} />;
      case 'admin-returns': return <AdminReturnRequests user={currentUser} onNavigate={navigateTo} />;
      case 'admin-reports': return <AdminReports user={currentUser} onNavigate={navigateTo} />;
      case 'admin-return-periods': return <AdminReturnPeriodsManager user={currentUser} onNavigate={navigateTo} />;
      
      default: return <Dashboard user={currentUser} onNavigate={navigateTo} />;
    }
  };

  if (loading) {
    return <LoadingComponent message="Inicjalizacja aplikacji..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {currentUser && (
        isAdmin ? (
          <AdminNavbar 
            user={currentUser}
            currentView={currentView}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            onNavigate={navigateTo}
            onLogout={handleLogout}
          />
        ) : (
          <Navbar 
            user={currentUser}
            currentView={currentView}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            onNavigate={navigateTo}
            onLogout={handleLogout}
          />
        )
      )}
      <main className={`transition-all duration-300 ${currentUser ? 'pt-16' : ''} ${sidebarOpen && currentUser ? 'lg:pl-80' : ''}`}>
        <div className="p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<LoadingComponent />}>
            {renderView()}
          </Suspense>
        </div>
      </main>
    </div>
  );
}

export default App;
