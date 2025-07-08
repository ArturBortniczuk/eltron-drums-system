// src/components/LoginForm.js - ZOPTYMALIZOWANA WERSJA z przełącznikiem
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Building2, Shield, CheckCircle, ArrowRight, UserCheck, Wifi, WifiOff } from 'lucide-react';
import { authAPI, handleAPIError, connectionHelpers } from '../utils/api';

const LoginForm = ({ onLogin }) => {
  const [nip, setNip] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState('client'); // 'client' or 'admin'
  const [isOnline, setIsOnline] = useState(connectionHelpers ? connectionHelpers.isOnline() : true);
  const [companyFound, setCompanyFound] = useState(null);

  // Mock data for testing when API is not available
  const mockCompanies = {
    '8513255117': 'AS ELECTRIC SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
    '6792693162': 'PRZEDSIĘBIORSTWO NAPRAW I UTRZYMANIA INFRASTRUKTURY KOLEJOWEJ W KRAKOWIE SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
    '5260001336': 'BUDIMEX S.A.',
    '9571010955': 'MOSTOSTAL WARSZAWA S.A.',
    '0000000000': 'Administrator Systemu',
    '1111111111': 'Supervisor'
  };

  // Monitor connection status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check if this is first login (for mock data fallback)
  const checkFirstLogin = (nip) => {
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
    return !registeredUsers[nip];
  };

  // Check if user exists when NIP is entered
  const handleNipSubmit = async () => {
    if (!nip) {
      setError('Wprowadź numer NIP');
      return;
    }

    if (loginMode === 'client' && nip.length !== 10) {
      setError('NIP musi mieć 10 cyfr');
      return;
    }

    if (loginMode === 'admin' && nip.length < 8) {
      setError('Wprowadź prawidłowy NIP administratora');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Try to check NIP first if authAPI is available
      if (authAPI && authAPI.checkNip) {
        const response = await authAPI.checkNip(nip, loginMode);
        
        if (response.exists) {
          setIsFirstLogin(response.firstLogin || false);
          setCompanyFound({ name: response.company?.name || 'Użytkownik znaleziony' });
        } else {
          if (loginMode === 'admin') {
            setError('Nie znaleziono konta administratora dla podanego NIP');
          } else {
            setError('Nie znaleziono konta dla podanego NIP. Sprawdź czy numer jest prawidłowy.');
          }
        }
      } else {
        // Fallback to mock data
        if (mockCompanies[nip]) {
          const isFirst = checkFirstLogin(nip);
          setIsFirstLogin(isFirst);
          setCompanyFound({ name: mockCompanies[nip] });
        } else {
          if (loginMode === 'admin') {
            setError('Nie znaleziono konta administratora dla podanego NIP');
          } else {
            setError('Nie znaleziono konta dla podanego NIP. Sprawdź czy numer jest prawidłowy.');
          }
        }
      }
    } catch (error) {
      // Handle API errors and fallback to mock data
      console.warn('API check failed, using mock data:', error.message);
      
      if (mockCompanies[nip]) {
        const isFirst = checkFirstLogin(nip);
        setIsFirstLogin(isFirst);
        setCompanyFound({ name: mockCompanies[nip] });
      } else {
        const errorMessage = handleAPIError ? handleAPIError(error, setError) : error.message;
        
        if (errorMessage.includes('not found')) {
          if (loginMode === 'admin') {
            setError('Nie znaleziono konta administratora dla podanego NIP');
          } else {
            setError('Nie znaleziono konta dla podanego NIP. Sprawdź czy numer jest prawidłowy.');
          }
        } else if (!isOnline) {
          setError('Brak połączenia z internetem. Sprawdź połączenie i spróbuj ponownie.');
        } else {
          setError('Wystąpił błąd podczas sprawdzania konta');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      let response;

      if (isFirstLogin) {
        // Validate new password
        if (newPassword !== confirmPassword) {
          setError('Hasła nie są identyczne');
          setLoading(false);
          return;
        }
        if (newPassword.length < 6) {
          setError('Hasło musi mieć minimum 6 znaków');
          setLoading(false);
          return;
        }
        
        // Register new password
        if (authAPI && authAPI.register) {
          response = await authAPI.register(nip, newPassword, confirmPassword, loginMode);
        } else {
          // Fallback mock registration
          const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
          registeredUsers[nip] = newPassword;
          localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
          
          response = {
            success: true,
            user: {
              nip,
              role: loginMode,
              companyName: companyFound.name,
              fullName: companyFound.name
            }
          };
        }
      } else {
        // Login with existing password
        if (!password) {
          setError('Wprowadź hasło');
          setLoading(false);
          return;
        }
        
        if (authAPI && authAPI.login) {
          response = await authAPI.login(nip, password, loginMode);
        } else {
          // Fallback mock login
          const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
          if (registeredUsers[nip] === password) {
            response = {
              success: true,
              user: {
                nip,
                role: loginMode,
                companyName: companyFound.name,
                fullName: companyFound.name
              }
            };
          } else {
            throw new Error('Invalid password');
          }
        }
      }

      // Login successful
      if (response && response.success && response.user) {
        onLogin(response.user);
      } else {
        setError('Nieoczekiwana odpowiedź serwera');
      }
      
    } catch (error) {
      const errorMessage = handleAPIError ? handleAPIError(error, setError) : error.message;
      
      // Provide specific error messages
      if (errorMessage.includes('Invalid password') || errorMessage.includes('password')) {
        setError('Nieprawidłowe hasło. Spróbuj ponownie.');
      } else if (errorMessage.includes('Passwords do not match')) {
        setError('Hasła nie są identyczne');
      } else if (errorMessage.includes('Password must be')) {
        setError('Hasło musi mieć minimum 6 znaków');
      } else if (!isOnline) {
        setError('Brak połączenia z internetem. Sprawdź połączenie i spróbuj ponownie.');
      } else {
        setError('Wystąpił błąd podczas logowania');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNip('');
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsFirstLogin(false);
    setCompanyFound(null);
    setError('');
    setLoading(false);
  };

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter' && !loading) {
      action();
    }
  };

  const isNipValid = () => {
    if (loginMode === 'admin') {
      return nip.length >= 8;
    }
    return nip.length === 10;
  };

  const canProceedWithNip = () => {
    return isNipValid() && !loading;
  };

  const canProceedWithPassword = () => {
    if (loading) return false;
    
    if (isFirstLogin) {
      return newPassword.length >= 6 && confirmPassword.length >= 6;
    }
    return password.length > 0;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          <div className="mx-auto h-20 w-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-xl mb-6 animate-pulse">
            <Building2 className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
            Grupa Eltron
          </h2>
          <p className="mt-2 text-lg text-gray-600">
            System Zarządzania Bębnami
          </p>
          <div className="mt-4 flex items-center justify-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Bezpieczne logowanie</span>
            </div>
            <div className={`flex items-center space-x-2 ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
              {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
          <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs bg-green-100 text-green-800">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
            </svg>
            Powered by Supabase
          </div>
        </div>

        {/* Connection Warning */}
        {!isOnline && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <WifiOff className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Brak połączenia z internetem</p>
                <p className="text-xs text-yellow-700">Niektóre funkcje mogą być niedostępne</p>
              </div>
            </div>
          </div>
        )}

        {/* Login Mode Selector */}
        <div className="bg-white/60 backdrop-blur-lg rounded-2xl p-2 shadow-lg border border-blue-100">
          <div className="flex">
            <button
              onClick={() => {
                setLoginMode('client');
                resetForm();
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center space-x-2 ${
                loginMode === 'client'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Klient</span>
            </button>
            <button
              onClick={() => {
                setLoginMode('admin');
                resetForm();
              }}
              className={`flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center space-x-2 ${
                loginMode === 'admin'
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Administrator</span>
            </button>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl border border-blue-100 p-8 space-y-6">
          {!companyFound ? (
            // NIP Input Phase
            <div className="space-y-6">
              <div className="text-center">
                {loginMode === 'admin' ? (
                  <UserCheck className="w-16 h-16 mx-auto text-purple-600 mb-4" />
                ) : (
                  <Building2 className="w-16 h-16 mx-auto text-blue-600 mb-4" />
                )}
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {loginMode === 'admin' ? 'Panel Administratora' : 'Logowanie Klienta'}
                </h3>
                <p className="text-sm text-gray-600">
                  {loginMode === 'admin' 
                    ? 'Wpisz swój NIP administratora aby kontynuować'
                    : 'Wpisz swój numer NIP aby kontynuować'
                  }
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="nip" className="block text-sm font-medium text-gray-700 mb-2">
                    {loginMode === 'admin' ? 'NIP Administratora' : 'Numer NIP'}
                  </label>
                  <div className="relative">
                    <input
                      id="nip"
                      type="text"
                      value={nip}
                      onChange={(e) => setNip(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onKeyPress={(e) => handleKeyPress(e, handleNipSubmit)}
                      className="block w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                      placeholder={loginMode === 'admin' ? 'NIP administratora' : 'Wpisz 10-cyfrowy NIP'}
                      disabled={loading}
                      autoComplete="username"
                    />
                    {isNipValid() && (
                      <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-500" />
                    )}
                  </div>
                </div>

                {/* Quick Login Hints */}
                {loginMode === 'admin' && (
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-xs text-purple-700 mb-1">💡 Dane testowe administratora:</p>
                    <p className="text-xs text-purple-600">NIP: <strong>0000000000</strong> (admin) lub <strong>1111111111</strong> (supervisor)</p>
                  </div>
                )}

                {loginMode === 'client' && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-700 mb-1">💡 Przykładowe NIP-y klientów:</p>
                    <p className="text-xs text-blue-600"><strong>8513255117</strong>, <strong>6792693162</strong>, <strong>5260001336</strong></p>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 animate-shake">
                    <p className="text-sm text-red-600 flex items-center">
                      <span className="w-2 h-2 bg-red-500 rounded-full mr-2 flex-shrink-0"></span>
                      {error}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleNipSubmit}
                  disabled={!canProceedWithNip()}
                  className={`w-full py-3 px-4 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2 ${
                    loginMode === 'admin'
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 focus:ring-purple-500'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500'
                  }`}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Sprawdź NIP</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            // Password Phase
            <div className="space-y-6">
              <div className="text-center">
                {isFirstLogin ? (
                  <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      🎉 Pierwsze logowanie!
                    </h3>
                    <p className="text-sm text-gray-600">
                      Ustaw bezpieczne hasło dla swojego konta
                    </p>
                    {companyFound.name && (
                      <p className="text-xs text-gray-500 mt-1">
                        Konto: {companyFound.name}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {loginMode === 'admin' ? '👋 Witaj, Administratorze!' : 'Witaj ponownie!'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Wpisz hasło aby kontynuować
                    </p>
                    {companyFound.name && (
                      <p className="text-xs text-gray-500 mt-1">
                        Logowanie do: {companyFound.name}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {isFirstLogin ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nowe hasło
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          onKeyPress={(e) => handleKeyPress(e, handlePasswordSubmit)}
                          className="block w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                          placeholder="Minimum 6 znaków"
                          disabled={loading}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          tabIndex="-1"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {newPassword && (
                        <div className="mt-2">
                          <div className="text-xs text-gray-600 mb-1">Siła hasła:</div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                newPassword.length < 6 ? 'bg-red-500 w-1/3' :
                                newPassword.length < 8 ? 'bg-yellow-500 w-2/3' :
                                'bg-green-500 w-full'
                              }`}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Potwierdź hasło
                      </label>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, handlePasswordSubmit)}
                        className="block w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Powtórz hasło"
                        disabled={loading}
                        autoComplete="new-password"
                      />
                      {confirmPassword && newPassword && (
                        <div className="mt-1 text-xs">
                          {newPassword === confirmPassword ? (
                            <span className="text-green-600">✓ Hasła są identyczne</span>
                          ) : (
                            <span className="text-red-600">✗ Hasła nie są identyczne</span>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hasło
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, handlePasswordSubmit)}
                        className="block w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Wpisz hasło"
                        disabled={loading}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex="-1"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 animate-shake">
                    <p className="text-sm text-red-600 flex items-center">
                      <span className="w-2 h-2 bg-red-500 rounded-full mr-2 flex-shrink-0"></span>
                      {error}
                    </p>
                  </div>
                )}

                <button
                  onClick={handlePasswordSubmit}
                  disabled={!canProceedWithPassword()}
                  className={`w-full py-3 px-4 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2 ${
                    isFirstLogin 
                      ? 'bg-gradient-to-r from-green-600 to-blue-600 text-white hover:from-green-700 hover:to-blue-700 focus:ring-green-500'
                      : loginMode === 'admin'
                        ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 focus:ring-purple-500'
                        : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500'
                  }`}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>{isFirstLogin ? 'Ustaw hasło i zaloguj' : 'Zaloguj się'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  onClick={resetForm}
                  className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200"
                >
                  ← Wróć do wpisywania NIP
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>© 2025 Grupa Eltron. Wszystkie prawa zastrzeżone.</p>
          <p className="text-xs mt-1">Wersja: 1.0.0 | Status API: {isOnline ? 'Połączono' : 'Rozłączono'}</p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
