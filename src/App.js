// src/App.js - ZOPTYMALIZOWANA WERSJA
import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { authAPI, initAPI, apiConfig } from './utils/api';
import './App.css';

// Lazy load components for better performance
const Navbar = React.lazy(() => import('./components/Navbar'));
const AdminNavbar = React.lazy(() => import('./components/AdminNavbar'));
const LoginForm = React.lazy(() => import('./components/LoginForm'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const DrumsList = React.lazy(() => import('./components/DrumsList'));
const ReturnForm = React.lazy(() => import('./components/ReturnForm'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const AdminClientsList = React.lazy(() => import('./components/AdminClientsList'));
const AdminReturnPeriodsManager = React.lazy(() => import('./components/AdminReturnPeriodsManager'));
const AdminDrumsList = React.lazy(() => import('./components/AdminDrumsList'));
const AdminReturnRequests = React.lazy(() => import('./components/AdminReturnRequests'));
const AdminReports = React.lazy(() => import('./components/AdminReports'));

// Loading component
const LoadingSpinner = ({ message = "Ładowanie..." }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-600 font-medium">{message}</p>
      <p className="text-xs text-gray-500 mt-2">
        Tryb: {apiConfig.useMockData ? 'Demo' : 'Produkcja'}
      </p>
    </div>
  </div>
);

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-red-100">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Wystąpił błąd aplikacji</h1>
            <p className="text-gray-600 mb-6">
              Aplikacja napotkała nieoczekiwany błąd. Spróbuj odświeżyć stronę.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200"
            >
              Odśwież stronę
            </button>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500">Szczegóły błędu</summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {this.state.error?.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const App = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [selectedDrum, setSelectedDrum] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navigationData, setNavigationData] = useState(null);
  const [appInitialized, setAppInitialized] = useState(false);
  const [initError, setInitError] = useState(null);

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Initializing Eltron Drums System...');
        
        // Initialize API
        await initAPI();
        
        // Check if user is already logged in
        const user = authAPI.getCurrentUser();
        if (user && authAPI.isAuthenticated()) {
          console.log('✅ User session restored:', user);
          setCurrentUser(user);
          
          // Set appropriate default view based on user role
          const defaultView = (user.role === 'admin' || user.role === 'supervisor') 
            ? 'admin-dashboard' 
            : 'dashboard';
          setCurrentView(defaultView);
        } else {
          console.log('ℹ️ No user session found');
          setCurrentView('login');
        }
        
        setAppInitialized(true);
        console.log('✅ App initialization complete');
        
      } catch (error) {
        console.error('❌ App initialization failed:', error);
        setInitError(error.message || 'Błąd inicjalizacji aplikacji');
        setAppInitialized(true);
      }
    };

    initializeApp();
  }, []);

  const logout = useCallback(() => {
    console.log('🚪 Logging out user');
    authAPI.logout();
    setCurrentUser(null);
    setCurrentView('login');
    setSidebarOpen(false);
    setSelectedDrum(null);
    setNavigationData(null);
  }, []);

  const navigateTo = useCallback((view, data = null) => {
    console.log('🧭 Navigating to:', view, data ? 'with data' : '');
    setCurrentView(view);
    
    if (data) {
      if (data.drum) setSelectedDrum(data.drum);
      if (data.navigationData) setNavigationData(data.navigationData);
      // Handle drum parameter for ReturnForm
      if (data && typeof data === 'object' && data.KOD_BEBNA) {
        setSelectedDrum(data);
      }
    }
    setSidebarOpen(false);
  }, []);

  const handleLogin = useCallback((user) => {
    console.log('✅ User logged in:', user);
    setCurrentUser(user);
    
    const defaultView = (user.role === 'admin' || user.role === 'supervisor') 
      ? 'admin-dashboard' 
      : 'dashboard';
    setCurrentView(defaultView);
  }, []);

  const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'supervisor');

  // Show loading during initialization
  if (!appInitialized) {
    return <LoadingSpinner message="Inicjalizacja aplikacji..." />;
  }

  // Show initialization error
  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-red-100">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Błąd inicjalizacji</h1>
          <p className="text-gray-600 mb-6">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200"
          >
            Spróbuj ponownie
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100">
        {/* Navigation */}
        {currentUser && (
          <Suspense fallback={<LoadingSpinner message="Ładowanie nawigacji..." />}>
            {isAdmin ? (
              <AdminNavbar 
                user={currentUser}
                currentView={currentView}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                onNavigate={navigateTo}
                onLogout={logout}
              />
            ) : (
              <Navbar 
                user={currentUser}
                currentView={currentView}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                onNavigate={navigateTo}
                onLogout={logout}
              />
            )}
          </Suspense>
        )}
        
        {/* Main Content */}
        <div className={`transition-all duration-300 ${currentUser ? 'lg:ml-0' : ''}`}>
          <Suspense fallback={<LoadingSpinner message="Ładowanie strony..." />}>
            {/* Login */}
            {currentView === 'login' && (
              <LoginForm onLogin={handleLogin} />
            )}
            
            {/* Client Views */}
            {currentView === 'dashboard' && currentUser && !isAdmin && (
              <Dashboard 
                user={currentUser}
                onNavigate={navigateTo}
              />
            )}
            
            {currentView === 'drums' && currentUser && !isAdmin && (
              <DrumsList 
                user={currentUser}
                onNavigate={navigateTo}
              />
            )}
            
            {currentView === 'return' && currentUser && !isAdmin && (
              <ReturnForm 
                user={currentUser}
                selectedDrum={selectedDrum}
                onNavigate={navigateTo}
                onSubmit={() => {
                  alert('✅ Zgłoszenie zwrotu zostało wysłane!');
                  navigateTo('dashboard');
                }}
              />
            )}

            {/* Admin Views */}
            {currentView === 'admin-dashboard' && currentUser && isAdmin && (
              <AdminDashboard 
                user={currentUser}
                onNavigate={navigateTo}
              />
            )}
            
            {currentView === 'admin-clients' && currentUser && isAdmin && (
              <AdminClientsList 
                user={currentUser}
                onNavigate={navigateTo}
                initialFilter={navigationData}
              />
            )}
            
            {currentView === 'admin-drums' && currentUser && isAdmin && (
              <AdminDrumsList 
                user={currentUser}
                onNavigate={navigateTo}
                initialFilter={navigationData}
              />
            )}
            
            {currentView === 'admin-returns' && currentUser && isAdmin && (
              <AdminReturnRequests 
                user={currentUser}
                onNavigate={navigateTo}
                initialFilter={navigationData}
              />
            )}
            
            {currentView === 'admin-reports' && currentUser && isAdmin && (
              <AdminReports 
                user={currentUser}
                onNavigate={navigateTo}
              />
            )}
            
            {currentView === 'admin-return-periods' && currentUser && isAdmin && (
              <AdminReturnPeriodsManager 
                user={currentUser}
                onNavigate={navigateTo}
              />
            )}

            {/* Fallback for unknown views */}
            {!['login', 'dashboard', 'drums', 'return', 'admin-dashboard', 'admin-clients', 'admin-drums', 'admin-returns', 'admin-reports', 'admin-return-periods'].includes(currentView) && (
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Strona nie znaleziona</h2>
                  <p className="text-gray-600 mb-6">Strona "{currentView}" nie istnieje.</p>
                  <button
                    onClick={() => navigateTo(isAdmin ? 'admin-dashboard' : 'dashboard')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200"
                  >
                    Wróć do głównej strony
                  </button>
                </div>
              </div>
            )}
          </Suspense>
        </div>

        {/* Debug Info (only in development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-2 rounded max-w-sm">
            <div>Tryb: {apiConfig.useMockData ? 'Mock Data' : 'API'}</div>
            <div>Online: {apiConfig.isOnline ? 'Tak' : 'Nie'}</div>
            <div>User: {currentUser?.role || 'Brak'}</div>
            <div>View: {currentView}</div>
            <div>API URL: {apiConfig.baseUrl || 'Brak'}</div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
