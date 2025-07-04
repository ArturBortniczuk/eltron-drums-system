// src/utils/api.js - ZOPTYMALIZOWANA WERSJA

const API_BASE_URL = process.env.REACT_APP_API_URL || '';
const USE_MOCK_DATA = process.env.REACT_APP_USE_MOCK_DATA === 'false' || !API_BASE_URL;

// Import mock data jako fallback
import { mockDrumsData } from '../data/mockData';
import { mockCompanies, mockReturnRequests } from '../data/additionalData';

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Helper function to check if user is logged in
const isAuthenticated = () => {
  const token = getAuthToken();
  const user = localStorage.getItem('currentUser');
  return !!(token && user);
};

// Connection helpers
export const connectionHelpers = {
  isOnline: () => navigator.onLine,
  
  // Check if API is available
  checkAPIHealth: async () => {
    if (USE_MOCK_DATA) return true;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      console.warn('API health check failed:', error);
      return false;
    }
  }
};

// Helper function to make authenticated requests
const makeRequest = async (url, options = {}) => {
  // If using mock data, return mock responses
  if (USE_MOCK_DATA) {
    return handleMockRequest(url, options);
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

  try {
    const response = await fetch(`${API_BASE_URL}${url}`, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    // Fallback to mock data if API fails and we're in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('API request failed, falling back to mock data:', error);
      return handleMockRequest(url, options);
    }
    throw error;
  }
};

// Mock request handler
const handleMockRequest = async (url, options = {}) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
  
  const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
  
  // Handle different endpoints
  if (url.includes('/api/drums')) {
    if (user.role === 'admin' || user.role === 'supervisor') {
      return mockDrumsData; // Admin sees all drums
    } else {
      // Client sees only their drums
      return mockDrumsData.filter(drum => drum.NIP === user.nip);
    }
  }
  
  if (url.includes('/api/companies')) {
    if (user.role === 'admin' || user.role === 'supervisor') {
      return mockCompanies;
    } else {
      return mockCompanies.filter(company => company.nip === user.nip);
    }
  }
  
  if (url.includes('/api/returns')) {
    if (user.role === 'admin' || user.role === 'supervisor') {
      return mockReturnRequests;
    } else {
      return mockReturnRequests.filter(request => request.user_nip === user.nip);
    }
  }
  
  if (url.includes('/api/auth/login')) {
    // Mock login response
    const { nip, password, loginMode } = JSON.parse(options.body || '{}');
    
    if (loginMode === 'admin') {
      // Simple mock admin check
      if ((nip === '0000000000' || nip === '1111111111') && password) {
        const mockToken = 'mock-admin-token-' + Date.now();
        return {
          token: mockToken,
          user: {
            id: 1,
            nip: nip,
            username: nip === '0000000000' ? 'admin' : 'supervisor',
            name: nip === '0000000000' ? 'Administrator Systemu' : 'Supervisor',
            email: `${nip === '0000000000' ? 'admin' : 'supervisor'}@grupaeltron.pl`,
            role: nip === '0000000000' ? 'admin' : 'supervisor',
            companyName: 'Grupa Eltron - Administrator'
          }
        };
      }
    } else {
      // Client login
      const userData = mockDrumsData.find(item => item.NIP === nip);
      if (userData && password) {
        const mockToken = 'mock-client-token-' + Date.now();
        return {
          token: mockToken,
          user: {
            nip: nip,
            companyName: userData.PELNA_NAZWA_KONTRAHENTA,
            role: 'client'
          }
        };
      }
    }
    
    throw new Error('Invalid credentials');
  }
  
  // Default response
  return { success: true, data: [] };
};

// Auth API
export const authAPI = {
  async login(nip, password, loginMode = 'client') {
    const response = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ nip, password, loginMode }),
    });

    if (response.token) {
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

    if (response.token) {
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('currentUser', JSON.stringify(response.user));
    }
    
    return response;
  },

  logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
  },

  getCurrentUser() {
    try {
      const user = localStorage.getItem('currentUser');
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error('Error parsing current user:', error);
      return null;
    }
  },

  isAuthenticated
};

// Drums API
export const drumsAPI = {
  async getDrums(nip = null) {
    const url = nip ? `/api/drums?nip=${nip}` : '/api/drums';
    return makeRequest(url);
  },

  async getDrum(id) {
    return makeRequest(`/api/drums/${id}`);
  }
};

// Companies API
export const companiesAPI = {
  async getCompanies() {
    return makeRequest('/api/companies');
  },

  async getCompany(nip) {
    return makeRequest(`/api/companies?nip=${nip}`);
  },

  async updateCompany(nip, data) {
    return makeRequest(`/api/companies?nip=${nip}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
};

// Returns API
export const returnsAPI = {
  async getReturns(nip = null) {
    const url = nip ? `/api/returns?nip=${nip}` : '/api/returns';
    return makeRequest(url);
  },

  async createReturn(returnData) {
    return makeRequest('/api/returns', {
      method: 'POST',
      body: JSON.stringify(returnData),
    });
  },

  async updateReturnStatus(id, status) {
    return makeRequest(`/api/returns?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }
};

// Return Periods API
export const returnPeriodsAPI = {
  async getReturnPeriods() {
    return makeRequest('/api/return-periods');
  },

  async getReturnPeriod(nip) {
    return makeRequest(`/api/return-periods?nip=${nip}`);
  },

  async updateReturnPeriod(nip, days) {
    return makeRequest(`/api/return-periods?nip=${nip}`, {
      method: 'PUT',
      body: JSON.stringify({ returnPeriodDays: days }),
    });
  }
};

// Enhanced error handler
export const handleAPIError = (error, setError = null) => {
  console.error('API Error:', error);
  
  let errorMessage = 'Wystąpił błąd podczas połączenia z serwerem';
  
  if (error.message) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  
  // Specific error messages
  if (errorMessage.includes('Failed to fetch')) {
    errorMessage = 'Brak połączenia z serwerem. Sprawdź połączenie internetowe.';
  } else if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
    errorMessage = 'Sesja wygasła. Zaloguj się ponownie.';
    authAPI.logout();
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  } else if (errorMessage.includes('403')) {
    errorMessage = 'Brak uprawnień do wykonania tej operacji.';
  } else if (errorMessage.includes('404')) {
    errorMessage = 'Nie znaleziono żądanych danych.';
  } else if (errorMessage.includes('500')) {
    errorMessage = 'Błąd serwera. Spróbuj ponownie za chwilę.';
  }
  
  if (setError) {
    setError(errorMessage);
  }
  
  return errorMessage;
};

// App initialization
export const initAPI = async () => {
  // Check if we should use mock data
  console.log(`🚀 Initializing API (Mock mode: ${USE_MOCK_DATA})`);
  
  if (!USE_MOCK_DATA) {
    // Check API health
    const isHealthy = await connectionHelpers.checkAPIHealth();
    if (!isHealthy) {
      console.warn('⚠️ API is not available, falling back to mock data');
    }
  }
  
  // Validate stored user data
  const token = getAuthToken();
  const user = localStorage.getItem('currentUser');
  
  if (token && user) {
    try {
      JSON.parse(user); // Validate JSON
      console.log('✅ User session restored');
    } catch (error) {
      console.warn('⚠️ Invalid user data, clearing session');
      authAPI.logout();
    }
  }
};

// Export configuration for debugging
export const apiConfig = {
  baseUrl: API_BASE_URL,
  useMockData: USE_MOCK_DATA,
  isOnline: connectionHelpers.isOnline(),
  isAuthenticated: isAuthenticated()
};
