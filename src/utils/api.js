// src/utils/api.js - NAPRAWIONA WERSJA (WSZYSTKIE IMPORTY NA GÓRZE)
import { mockDrumsData } from '../data/mockData';
import { mockCompanies, mockReturnRequests } from '../data/additionalData';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';
const USE_MOCK_DATA = process.env.REACT_APP_USE_MOCK_DATA === 'true' || !API_BASE_URL;

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
    return mockCompanies;
  }
  
  if (url.includes('/api/returns')) {
    if (user.role === 'admin' || user.role === 'supervisor') {
      return mockReturnRequests;
    } else {
      return mockReturnRequests.filter(req => req.user_nip === user.nip);
    }
  }
  
  // Default empty response
  return [];
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

// Auth API
export const authAPI = {
  async login(nip, password, role = 'client') {
    if (USE_MOCK_DATA) {
      // Mock login logic
      const mockUser = {
        nip,
        role,
        companyName: `Firma ${nip.slice(-3)}`,
        fullName: `FIRMA ${nip.slice(-3)} SP. Z O.O.`
      };
      
      localStorage.setItem('authToken', 'mock-token-' + Date.now());
      localStorage.setItem('currentUser', JSON.stringify(mockUser));
      
      return { success: true, user: mockUser };
    }
    
    return makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ nip, password, role }),
    });
  },

  async checkNip(nip, role = 'client') {
    if (USE_MOCK_DATA) {
      return { 
        exists: nip.length >= 8, 
        isFirstLogin: Math.random() > 0.5,
        companyName: `Firma ${nip.slice(-3)}`
      };
    }
    
    return makeRequest('/api/auth/check-nip', {
      method: 'POST',
      body: JSON.stringify({ nip, role }),
    });
  },

  async setPassword(nip, password, role = 'client') {
    if (USE_MOCK_DATA) {
      return { success: true };
    }
    
    return makeRequest('/api/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ nip, password, role }),
    });
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
