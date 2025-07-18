// src/components/AdminClientsList.js - Wersja z API
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { companiesAPI, handleAPIError } from '../utils/api';
import { 
  Users, 
  Search, 
  Filter, 
  Eye,
  Package,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Building2,
  AlertCircle,
  Clock,
  ArrowUpDown,
  MoreVertical,
  RefreshCw
} from 'lucide-react';

const LoadingComponent = () => <div className="text-center p-12">Ładowanie klientów...</div>;
const ErrorComponent = ({ message, onRetry }) => (
    <div className="text-center p-12 text-red-600">
        <p>Wystąpił błąd: {message}</p>
        <button onClick={onRetry} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">Spróbuj ponownie</button>
    </div>
);

const AdminClientsList = ({ onNavigate }) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientDetails, setShowClientDetails] = useState(false);

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

  const enrichedClients = useMemo(() => {
    return clients.map(client => ({
      ...client,
      drumsCount: client.drums_count || 0,
      overdueDrums: client.overdue_drums || 0,
      pendingRequests: client.pending_requests || 0,
      totalRequests: client.total_requests || 0,
      riskLevel: client.overdue_drums > 0 ? 'high' : 
                 client.pending_requests > 0 ? 'medium' : 'low'
    }));
  }, [clients]);

  const filteredAndSortedClients = useMemo(() => {
    let filtered = enrichedClients.filter(client => {
      const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           client.nip.includes(searchTerm) ||
                           (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()));
      
      if (!matchesSearch) return false;

      if (filterStatus === 'all') return true;
      if (filterStatus === 'high-risk' && client.riskLevel === 'high') return true;
      if (filterStatus === 'pending' && client.pendingRequests > 0) return true;
      if (filterStatus === 'active' && client.status === 'Aktywny') return true;
      
      return false;
    });

    return filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'last_activity') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [enrichedClients, searchTerm, sortBy, sortOrder, filterStatus]);
  
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleViewClient = (client) => {
    setSelectedClient(client);
    setShowClientDetails(true);
  };
  
  const getRiskBadge = (riskLevel) => {
    const badges = {
      high: { color: 'bg-red-100 text-red-800 border-red-200', text: 'Wysokie ryzyko' },
      medium: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', text: 'Średnie ryzyko' },
      low: { color: 'bg-green-100 text-green-800 border-green-200', text: 'Niskie ryzyko' }
    };
    
    const badge = badges[riskLevel] || { color: 'bg-gray-100 text-gray-800', text: 'Brak danych' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  const ClientCard = ({ client, index }) => (
    <div 
      className="bg-white/90 rounded-2xl p-6 shadow-lg border border-blue-100 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 line-clamp-2">{client.name}</h3>
            <p className="text-sm text-gray-600">NIP: {client.nip}</p>
          </div>
        </div>
        <div className="flex-shrink-0 ml-2">
            {getRiskBadge(client.riskLevel)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center space-x-2 text-sm">
          <Package className="w-4 h-4 text-blue-600" />
          <span className="text-gray-600">Bębny:</span>
          <span className="font-medium text-gray-900">{client.drumsCount}</span>
        </div>
        
        <div className="flex items-center space-x-2 text-sm">
          <Clock className="w-4 h-4 text-yellow-600" />
          <span className="text-gray-600">Oczekujące:</span>
          <span className="font-medium text-gray-900">{client.pendingRequests}</span>
        </div>
        
        {client.overdueDrums > 0 && (
          <div className="flex items-center space-x-2 text-sm">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-gray-600">Przeterminowane:</span>
            <span className="font-medium text-red-600">{client.overdueDrums}</span>
          </div>
        )}
      </div>

      <div className="space-y-2 mb-4 text-sm">
        <div className="flex items-center space-x-2 text-gray-600">
          <Mail className="w-4 h-4" />
          <span>{client.email}</span>
        </div>
        <div className="flex items-center space-x-2 text-gray-600">
          <Phone className="w-4 h-4" />
          <span>{client.phone}</span>
        </div>
        <div className="flex items-center space-x-2 text-gray-600">
          <MapPin className="w-4 h-4" />
          <span className="truncate">{client.address}</span>
        </div>
        <div className="flex items-center space-x-2 text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>Ostatnia aktywność: {new Date(client.last_activity).toLocaleDateString('pl-PL')}</span>
        </div>
      </div>

      <div className="flex space-x-2 mt-auto">
        <button
          onClick={() => handleViewClient(client)}
          className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-2 px-4 rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center space-x-2"
        >
          <Eye className="w-4 h-4" />
          <span>Szczegóły</span>
        </button>
        
        <button
          onClick={() => onNavigate('admin-drums', { clientNip: client.nip })}
          className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-xl font-medium hover:bg-gray-50 transition-all duration-200 flex items-center justify-center space-x-2"
        >
          <Package className="w-4 h-4" />
          <span>Bębny</span>
        </button>
      </div>
    </div>
  );
  
    const ClientDetailsModal = () => {
        if (!showClientDetails || !selectedClient) return null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Szczegóły klienta</h2>
                  <button
                    onClick={() => setShowClientDetails(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Informacje podstawowe</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Nazwa firmy</label>
                        <p className="text-gray-900">{selectedClient.name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">NIP</label>
                        <p className="text-gray-900">{selectedClient.nip}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Email</label>
                        <p className="text-gray-900">{selectedClient.email}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Telefon</label>
                        <p className="text-gray-900">{selectedClient.phone}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Adres</label>
                        <p className="text-gray-900">{selectedClient.address}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Statystyki</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Wszystkie bębny</span>
                        <span className="font-medium">{selectedClient.drumsCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Przeterminowane</span>
                        <span className="font-medium text-red-600">{selectedClient.overdueDrums}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Oczekujące zgłoszenia</span>
                        <span className="font-medium text-yellow-600">{selectedClient.pendingRequests}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Wszystkie zgłoszenia</span>
                        <span className="font-medium">{selectedClient.totalRequests}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status</span>
                        <span className="font-medium text-green-600">{selectedClient.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ostatnia aktywność</span>
                        <span className="font-medium">{new Date(selectedClient.last_activity).toLocaleDateString('pl-PL')}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      setShowClientDetails(false);
                      onNavigate('admin-drums', { clientNip: selectedClient.nip });
                    }}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-xl font-medium hover:bg-blue-700 transition-colors duration-200"
                  >
                    Zobacz bębny
                  </button>
                  <button
                    onClick={() => {
                      setShowClientDetails(false);
                      onNavigate('admin-returns', { initialFilter: { clientNip: selectedClient.nip } });
                    }}
                    className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-xl font-medium hover:bg-gray-700 transition-colors duration-200"
                  >
                    Zobacz zgłoszenia
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      };

    const stats = useMemo(() => ({
        total: enrichedClients.length,
        highRisk: enrichedClients.filter(c => c.riskLevel === 'high').length,
        pending: enrichedClients.filter(c => c.pendingRequests > 0).length,
        lowRisk: enrichedClients.filter(c => c.riskLevel === 'low').length,
    }), [enrichedClients]);


    if(loading) {
        return <LoadingComponent />;
    }

    if(error) {
        return <ErrorComponent message={error} onRetry={fetchClients} />;
    }

    return (
        <div>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                        Zarządzanie klientami
                        </h1>
                        <p className="text-gray-600">Przeglądaj i zarządzaj wszystkimi klientami w systemie</p>
                    </div>
                </div>
                <button onClick={fetchClients} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Filters and Search */}
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-blue-100 mb-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Szukaj po nazwie, NIP lub email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>

                {/* Filter */}
                <div className="relative">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="appearance-none bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="all">Wszyscy klienci</option>
                    <option value="active">Aktywni</option>
                    <option value="high-risk">Wysokie ryzyko</option>
                    <option value="pending">Z oczekującymi</option>
                  </select>
                  <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>

                {/* Sort */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleSort('name')}
                    className={`px-4 py-3 rounded-xl border transition-all duration-200 flex items-center space-x-2 ${
                      sortBy === 'name' 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-blue-50'
                    }`}
                  >
                    <span>Nazwa</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                  
                  <button
                    onClick={() => handleSort('last_activity')}
                    className={`px-4 py-3 rounded-xl border transition-all duration-200 flex items-center space-x-2 ${
                      sortBy === 'last_activity' 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-blue-50'
                    }`}
                  >
                    <span>Aktywność</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg border border-blue-100 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                <div className="text-sm text-gray-600">Wszyscy klienci</div>
              </div>
              <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg border border-green-100 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.lowRisk}
                </div>
                <div className="text-sm text-gray-600">Niskie ryzyko</div>
              </div>
              <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg border border-yellow-100 text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.pending}
                </div>
                <div className="text-sm text-gray-600">Z oczekującymi</div>
              </div>
              <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg border border-red-100 text-center">
                <div className="text-2xl font-bold text-red-600">
                  {stats.highRisk}
                </div>
                <div className="text-sm text-gray-600">Wysokie ryzyko</div>
              </div>
            </div>
          </div>

          {/* Clients Grid */}
          {filteredAndSortedClients.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
              {filteredAndSortedClients.map((client, index) => (
                <ClientCard key={client.nip} client={client} index={index} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nie znaleziono klientów</h3>
              <p className="text-gray-600 mb-6">Spróbuj zmienić kryteria wyszukiwania lub filtry</p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200"
              >
                Wyczyść filtry
              </button>
            </div>
          )}

          <ClientDetailsModal />
        </div>
      );
};

export default AdminClientsList;
