// src/components/DrumsList.js - ZOPTYMALIZOWANY
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Package, 
  Calendar, 
  Search, 
  Filter, 
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUpDown,
  ExternalLink,
  Truck,
  RefreshCw,
  Wifi,
  WifiOff,
  Download,
  Eye
} from 'lucide-react';
import { drumsAPI, handleAPIError, connectionHelpers } from '../utils/api';

const DrumsList = ({ user, onNavigate }) => {
  const [userDrums, setUserDrums] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('KOD_BEBNA');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(connectionHelpers.isOnline());
  const [selectedDrum, setSelectedDrum] = useState(null);
  const [showDrumDetails, setShowDrumDetails] = useState(false);

  // Monitor connection status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (userDrums.length === 0 || error) {
        fetchDrums();
      }
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [userDrums.length, error]);

  const fetchDrums = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await drumsAPI.getDrums();
      setUserDrums(data);
      
    } catch (error) {
      const errorMessage = handleAPIError(error, setError);
      console.error('Error fetching drums:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDrums();
    setRefreshing(false);
  };

  useEffect(() => {
    if (user?.nip) {
      fetchDrums();
    }
  }, [user?.nip, fetchDrums]);

  // Process drums data with status calculations
  const processedDrums = useMemo(() => {
    return userDrums.map(drum => {
      const now = new Date();
      
      // Handle different field name formats (API vs Mock data)
      const kodBebna = drum.KOD_BEBNA || drum.kod_bebna;
      const nazwa = drum.NAZWA || drum.nazwa;
      const returnDateStr = drum.DATA_ZWROTU_DO_DOSTAWCY || drum.data_zwrotu_do_dostawcy;
      const acceptDateStr = drum['Data przyjęcia na stan'] || drum.data_przyjecia_na_stan;
      const status = drum.STATUS || drum.status;
      const cecha = drum.CECHA || drum.cecha;
      const nrDokumentu = drum.NR_DOKUMENTUPZ || drum.nr_dokumentupz;
      
      const returnDate = new Date(returnDateStr);
      const acceptDate = new Date(acceptDateStr);
      
      const daysDiff = Math.ceil((returnDate - now) / (1000 * 60 * 60 * 24));
      const daysInPossession = Math.ceil((now - acceptDate) / (1000 * 60 * 60 * 24));
      
      // Determine status info
      let statusInfo = {
        icon: CheckCircle,
        text: 'Aktywny',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-200',
        category: 'active'
      };
      
      if (daysDiff < 0) {
        statusInfo = {
          icon: AlertCircle,
          text: `Przeterminowany (${Math.abs(daysDiff)} dni)`,
          color: 'text-red-600',
          bgColor: 'bg-red-100',
          borderColor: 'border-red-200',
          category: 'overdue'
        };
      } else if (daysDiff <= 7) {
        statusInfo = {
          icon: Clock,
          text: `Za ${daysDiff} dni`,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100',
          borderColor: 'border-yellow-200',
          category: 'due-soon'
        };
      }
      
      return {
        ...drum,
        // Normalized field names
        KOD_BEBNA: kodBebna,
        NAZWA: nazwa,
        DATA_ZWROTU_DO_DOSTAWCY: returnDateStr,
        'Data przyjęcia na stan': acceptDateStr,
        STATUS: status,
        CECHA: cecha,
        NR_DOKUMENTUPZ: nrDokumentu,
        
        // Calculated fields
        daysDiff,
        daysInPossession,
        overdueDays: daysDiff < 0 ? Math.abs(daysDiff) : 0,
        statusInfo
      };
    });
  }, [userDrums]);

  const filteredAndSortedDrums = useMemo(() => {
    let filtered = processedDrums.filter(drum => {
      const matchesSearch = (drum.KOD_BEBNA || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (drum.NAZWA || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;
      
      if (filterStatus === 'all') return true;
      return drum.statusInfo.category === filterStatus;
    });

    return filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'DATA_ZWROTU_DO_DOSTAWCY' || sortBy === 'Data przyjęcia na stan') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (sortBy === 'daysDiff' || sortBy === 'daysInPossession') {
        aValue = Number(aValue);
        bValue = Number(bValue);
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [processedDrums, searchTerm, sortBy, sortOrder, filterStatus]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleViewDrum = (drum) => {
    setSelectedDrum(drum);
    setShowDrumDetails(true);
  };

  const exportData = () => {
    try {
      const dataToExport = filteredAndSortedDrums.map(drum => ({
        'Kod bębna': drum.KOD_BEBNA,
        'Nazwa': drum.NAZWA,
        'Cecha': drum.CECHA,
        'Data zwrotu': new Date(drum.DATA_ZWROTU_DO_DOSTAWCY).toLocaleDateString('pl-PL'),
        'Status': drum.statusInfo.text,
        'Dni do zwrotu': drum.daysDiff,
        'Dokument': drum.NR_DOKUMENTUPZ
      }));
      
      const csvContent = [
        Object.keys(dataToExport[0]).join(','),
        ...dataToExport.map(row => Object.values(row).join(','))
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `bebny_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Błąd podczas exportu danych');
    }
  };

  const DrumCard = ({ drum, index }) => {
    const StatusIcon = drum.statusInfo.icon;
    
    return (
      <div 
        className={`
          bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border transition-all duration-300 
          hover:shadow-xl transform hover:scale-[1.02] ${drum.statusInfo.borderColor} animate-fadeIn
        `}
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-gray-900 truncate">{drum.KOD_BEBNA}</h3>
              <p className="text-sm text-gray-600 line-clamp-2">{drum.NAZWA}</p>
            </div>
          </div>
          
          <div className={`px-3 py-1 rounded-full ${drum.statusInfo.bgColor} flex items-center space-x-1 flex-shrink-0`}>
            <StatusIcon className={`w-4 h-4 ${drum.statusInfo.color}`} />
            <span className={`text-xs font-medium ${drum.statusInfo.color}`}>{drum.statusInfo.text}</span>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Cecha:</span>
            <span className="font-medium text-gray-900 truncate ml-2">{drum.CECHA}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Data przyjęcia:</span>
            <span className="font-medium text-gray-900">
              {new Date(drum['Data przyjęcia na stan']).toLocaleDateString('pl-PL')}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Termin zwrotu:</span>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className={`font-medium ${drum.statusInfo.color}`}>
                {new Date(drum.DATA_ZWROTU_DO_DOSTAWCY).toLocaleDateString('pl-PL')}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Dokument:</span>
            <span className="font-medium text-gray-900 truncate ml-2">{drum.NR_DOKUMENTUPZ}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">W posiadaniu:</span>
            <span className="font-medium text-gray-900">{drum.daysInPossession} dni</span>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => onNavigate('return', drum)}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Truck className="w-4 h-4" />
            <span>Zgłoś zwrot</span>
            <ExternalLink className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => handleViewDrum(drum)}
            className="w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded-xl font-medium hover:bg-gray-50 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <Eye className="w-4 h-4" />
            <span>Szczegóły</span>
          </button>
        </div>
      </div>
    );
  };

  const DrumDetailsModal = () => {
    if (!showDrumDetails || !selectedDrum) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Szczegóły bębna</h2>
              <button
                onClick={() => setShowDrumDetails(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Kod bębna</label>
                <p className="text-lg font-bold text-gray-900">{selectedDrum.KOD_BEBNA}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full ${selectedDrum.statusInfo.bgColor}`}>
                  <selectedDrum.statusInfo.icon className={`w-4 h-4 ${selectedDrum.statusInfo.color}`} />
                  <span className={`text-sm font-medium ${selectedDrum.statusInfo.color}`}>
                    {selectedDrum.statusInfo.text}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-500">Nazwa</label>
              <p className="text-gray-900">{selectedDrum.NAZWA}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Cecha</label>
                <p className="text-gray-900">{selectedDrum.CECHA}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Numer dokumentu</label>
                <p className="text-gray-900">{selectedDrum.NR_DOKUMENTUPZ}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Data przyjęcia</label>
                <p className="text-gray-900">
                  {new Date(selectedDrum['Data przyjęcia na stan']).toLocaleDateString('pl-PL')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Termin zwrotu</label>
                <p className={`font-medium ${selectedDrum.statusInfo.color}`}>
                  {new Date(selectedDrum.DATA_ZWROTU_DO_DOSTAWCY).toLocaleDateString('pl-PL')}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Dni w posiadaniu</label>
                <p className="text-gray-900">{selectedDrum.daysInPossession} dni</p>
              </div>
              {selectedDrum.daysDiff < 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Dni przeterminowania</label>
                  <p className="text-red-600 font-medium">{selectedDrum.overdueDays} dni</p>
                </div>
              )}
            </div>
            
            <div className="pt-4">
              <button
                onClick={() => {
                  setShowDrumDetails(false);
                  onNavigate('return', selectedDrum);
                }}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2"
              >
                <Truck className="w-4 h-4" />
                <span>Zgłoś zwrot tego bębna</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getStats = () => {
    const total = processedDrums.length;
    const active = processedDrums.filter(d => d.statusInfo.category === 'active').length;
    const dueSoon = processedDrums.filter(d => d.statusInfo.category === 'due-soon').length;
    const overdue = processedDrums.filter(d => d.statusInfo.category === 'overdue').length;
    
    return { total, active, dueSoon, overdue };
  };

  const stats = getStats();

  // Loading State
  if (loading && userDrums.length === 0) {
    return (
      <div className="">
        <div className="">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Ładowanie twoich bębnów...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error && userDrums.length === 0) {
    return (
      <div className="min-h-screen pt-6 lg:ml-80 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                {isOnline ? (
                  <AlertCircle className="w-10 h-10 text-red-600" />
                ) : (
                  <WifiOff className="w-10 h-10 text-red-600" />
                )}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {isOnline ? 'Błąd ładowania danych' : 'Brak połączenia z internetem'}
              </h3>
              <p className="text-gray-600 mb-6 max-w-md">{error}</p>
              <button
                onClick={handleRefresh}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Spróbuj ponownie</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-6 lg:ml-80 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                  Twoje bębny
                </h1>
                <p className="text-gray-600">Zarządzaj swoimi bębnami i planuj zwroty</p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </div>
              
              <button
                onClick={exportData}
                disabled={filteredAndSortedDrums.length === 0}
                className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
              
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 text-gray-600 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors duration-200"
                title="Odśwież dane"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Offline Warning */}
          {!isOnline && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-2">
                <WifiOff className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Tryb offline</p>
                  <p className="text-xs text-yellow-700">Wyświetlane są dane z pamięci podręcznej</p>
                </div>
              </div>
            </div>
          )}

          {/* Filters and Search */}
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-blue-100 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Szukaj po kodzie lub nazwie bębna..."
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
                  <option value="all">Wszystkie</option>
                  <option value="active">Aktywne</option>
                  <option value="due-soon">Zbliża się termin</option>
                  <option value="overdue">Przekroczony termin</option>
                </select>
                <Filter className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Sort */}
              <div className="flex space-x-2">
                <button
                  onClick={() => handleSort('KOD_BEBNA')}
                  className={`px-4 py-3 rounded-xl border transition-all duration-200 flex items-center space-x-2 ${
                    sortBy === 'KOD_BEBNA' 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-blue-50'
                  }`}
                >
                  <span>Kod</span>
                  <ArrowUpDown className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => handleSort('DATA_ZWROTU_DO_DOSTAWCY')}
                  className={`px-4 py-3 rounded-xl border transition-all duration-200 flex items-center space-x-2 ${
                    sortBy === 'DATA_ZWROTU_DO_DOSTAWCY' 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-blue-50'
                  }`}
                >
                  <span>Data</span>
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg border border-blue-100 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-600">Wszystkie bębny</div>
            </div>
            <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg border border-green-100 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              <div className="text-sm text-gray-600">Aktywne</div>
            </div>
            <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg border border-yellow-100 text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.dueSoon}</div>
              <div className="text-sm text-gray-600">Zbliża się termin</div>
            </div>
            <div className="bg-white/80 backdrop-blur-lg rounded-xl p-4 shadow-lg border border-red-100 text-center">
              <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
              <div className="text-sm text-gray-600">Przekroczony termin</div>
            </div>
          </div>
        </div>

        {/* Drums Grid */}
        {filteredAndSortedDrums.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
            {filteredAndSortedDrums.map((drum, index) => (
              <DrumCard key={drum.KOD_BEBNA || drum.kod_bebna} drum={drum} index={index} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm || filterStatus !== 'all' ? 'Nie znaleziono bębnów' : 'Brak bębnów'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filterStatus !== 'all' 
                ? 'Spróbuj zmienić kryteria wyszukiwania lub filtry'
                : 'Nie znaleziono bębnów przypisanych do Twojego konta'
              }
            </p>
            {(searchTerm || filterStatus !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200"
              >
                Wyczyść filtry
              </button>
            )}
          </div>
        )}

        <DrumDetailsModal />
      </div>
    </div>
  );
};

export default DrumsList;
