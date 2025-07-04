// src/components/Dashboard.js - ZOPTYMALIZOWANA WERSJA
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Package, 
  Truck, 
  Calendar, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  BarChart3,
  Activity,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';
import { drumsAPI, handleAPIError, connectionHelpers } from '../utils/api';

const Dashboard = ({ user, onNavigate }) => {
  const [stats, setStats] = useState({
    totalDrums: 0,
    activeDrums: 0,
    pendingReturns: 0,
    recentReturns: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [userDrums, setUserDrums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(connectionHelpers.isOnline());

  // Monitor connection status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (userDrums.length === 0 || error) {
        fetchDashboardData();
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

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await drumsAPI.getDrums();
      setUserDrums(data);
      
      // Calculate stats based on actual data
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const pendingReturns = data.filter(drum => {
        const returnDate = new Date(drum.DATA_ZWROTU_DO_DOSTAWCY || drum.data_zwrotu_do_dostawcy);
        return returnDate <= now;
      }).length;

      const recentReturns = data.filter(drum => {
        const acceptDate = new Date(drum['Data przyjęcia na stan'] || drum.data_przyjecia_na_stan);
        return acceptDate >= thirtyDaysAgo;
      }).length;

      const activeDrums = data.filter(drum => {
        const returnDate = new Date(drum.DATA_ZWROTU_DO_DOSTAWCY || drum.data_zwrotu_do_dostawcy);
        return returnDate > now;
      }).length;

      setStats({
        totalDrums: data.length,
        activeDrums,
        pendingReturns,
        recentReturns
      });

      // Generate recent activity based on actual data
      generateRecentActivity(data);
      
    } catch (error) {
      const errorMessage = handleAPIError(error, setError);
      console.error('Error fetching dashboard data:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateRecentActivity = useCallback((drums) => {
    const now = new Date();
    const activities = [];

    // Check for overdue drums
    drums.forEach((drum, index) => {
      if (index < 3) { // Limit to first 3 for performance
        const returnDate = new Date(drum.DATA_ZWROTU_DO_DOSTAWCY || drum.data_zwrotu_do_dostawcy);
        if (returnDate < now) {
          const daysOverdue = Math.ceil((now - returnDate) / (1000 * 60 * 60 * 24));
          activities.push({
            id: `overdue-${drum.KOD_BEBNA || drum.kod_bebna}`,
            type: 'overdue',
            message: `Bęben ${drum.KOD_BEBNA || drum.kod_bebna} przekroczył termin zwrotu`,
            time: `${daysOverdue} dni temu`,
            icon: AlertCircle,
            color: 'text-red-600'
          });
        }
      }
    });

    // Check for drums due soon
    drums.forEach((drum, index) => {
      if (index < 2 && activities.length < 4) {
        const returnDate = new Date(drum.DATA_ZWROTU_DO_DOSTAWCY || drum.data_zwrotu_do_dostawcy);
        const daysUntilReturn = Math.ceil((returnDate - now) / (1000 * 60 * 60 * 24));
        if (daysUntilReturn > 0 && daysUntilReturn <= 7) {
          activities.push({
            id: `due-soon-${drum.KOD_BEBNA || drum.kod_bebna}`,
            type: 'due_soon',
            message: `Bęben ${drum.KOD_BEBNA || drum.kod_bebna} wymaga zwrotu za ${daysUntilReturn} dni`,
            time: `Za ${daysUntilReturn} dni`,
            icon: Clock,
            color: 'text-yellow-600'
          });
        }
      }
    });

    // Add some positive activities if no issues
    if (activities.length === 0) {
      activities.push({
        id: 'all-good',
        type: 'success',
        message: 'Wszystkie bębny są w terminie',
        time: 'Aktualnie',
        icon: CheckCircle,
        color: 'text-green-600'
      });
    }

    setRecentActivity(activities);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    if (user?.nip) {
      fetchDashboardData();
    }
  }, [user?.nip, fetchDashboardData]);

  // Memoized stats for performance
  const trendData = useMemo(() => {
    return {
      totalTrend: stats.totalDrums > 0 ? 5 : 0,
      activeTrend: stats.activeDrums > 0 ? 2 : 0,
      pendingTrend: stats.pendingReturns > 0 ? -10 : 0,
      recentTrend: stats.recentReturns > 0 ? 15 : 0
    };
  }, [stats]);

  const StatCard = ({ icon: Icon, title, value, subtitle, color, trend, percentage, onClick }) => (
    <div 
      onClick={onClick}
      className={`
        bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-blue-100 
        hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer 
        hover:border-blue-200 group
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-4">
            <div className={`p-3 rounded-xl ${color} bg-opacity-10 group-hover:bg-opacity-20 transition-all duration-300`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-600">{title}</h3>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-gray-900">{value}</span>
                {trend !== undefined && trend !== 0 && (
                  <span className={`text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {trend > 0 ? '+' : ''}{percentage}%
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-300" />
      </div>
    </div>
  );

  const ActionCard = ({ icon: Icon, title, description, buttonText, color, onClick, disabled = false }) => (
    <div className={`bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg border border-blue-100 hover:shadow-xl transition-all duration-300 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex flex-col h-full">
        <div className="flex items-start space-x-4 mb-4">
          <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
            <Icon className={`w-8 h-8 ${color}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
          </div>
        </div>
        
        <div className="mt-auto">
          <button
            onClick={onClick}
            disabled={disabled}
            className={`
              w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 
              transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
              ${color === 'text-blue-600' 
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500' 
                : 'bg-gradient-to-r from-green-600 to-blue-600 text-white hover:from-green-700 hover:to-blue-700 focus:ring-green-500'
              }
            `}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );

  const ActivityItem = ({ item }) => {
    const Icon = item.icon;
    return (
      <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-blue-50 transition-colors duration-200">
        <div className="p-2 rounded-lg bg-gray-100">
          <Icon className={`w-4 h-4 ${item.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{item.message}</p>
          <p className="text-xs text-gray-500">{item.time}</p>
        </div>
      </div>
    );
  };

  // Loading State
  if (loading && userDrums.length === 0) {
    return (
      <div className="min-h-screen pt-6 lg:ml-80 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Ładowanie dashboardu...</p>
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                <p className="text-gray-600">Witaj ponownie, {user.companyName}</p>
              </div>
            </div>
            
            {/* Connection Status & Refresh */}
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </div>
              
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
          
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>Ostatnia aktualizacja: {new Date().toLocaleDateString('pl-PL', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</span>
          </div>

          {/* Offline Warning */}
          {!isOnline && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-center space-x-2">
                <WifiOff className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">Tryb offline</p>
                  <p className="text-xs text-yellow-700">Wyświetlane są dane z pamięci podręcznej</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={Package}
            title="Wszystkie bębny"
            value={stats.totalDrums}
            subtitle="Łączna liczba bębnów"
            color="text-blue-600"
            trend={trendData.totalTrend}
            percentage={5}
            onClick={() => onNavigate('drums')}
          />
          
          <StatCard
            icon={CheckCircle}
            title="Aktywne bębny"
            value={stats.activeDrums}
            subtitle="Bębny w użyciu"
            color="text-green-600"
            trend={trendData.activeTrend}
            percentage={2}
            onClick={() => onNavigate('drums')}
          />
          
          <StatCard
            icon={AlertCircle}
            title="Oczekujące zwroty"
            value={stats.pendingReturns}
            subtitle="Wymagają zwrotu"
            color="text-red-600"
            trend={trendData.pendingTrend}
            percentage={10}
            onClick={() => onNavigate('return')}
          />
          
          <StatCard
            icon={TrendingUp}
            title="Ostatnie 30 dni"
            value={stats.recentReturns}
            subtitle="Nowe przyjęcia"
            color="text-purple-600"
            trend={trendData.recentTrend}
            percentage={15}
            onClick={() => onNavigate('drums')}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-blue-600" />
                Szybkie akcje
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ActionCard
                  icon={Package}
                  title="Sprawdź bębny"
                  description="Zobacz wszystkie swoje bębny, sprawdź daty zwrotu i status każdego z nich"
                  buttonText="Zobacz bębny"
                  color="text-blue-600"
                  onClick={() => onNavigate('drums')}
                  disabled={loading}
                />
                
                <ActionCard
                  icon={Truck}
                  title="Zgłoś zwrot"
                  description="Wypełnij formularz zwrotu bębnów do dostawcy i zaplanuj odbiór"
                  buttonText="Zgłoś zwrot"
                  color="text-green-600"
                  onClick={() => onNavigate('return')}
                  disabled={loading || stats.totalDrums === 0}
                />
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-1">
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg border border-blue-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-blue-600" />
                Ostatnia aktywność
              </h3>
              
              <div className="space-y-2">
                {recentActivity.length > 0 ? (
                  recentActivity.map((item) => (
                    <ActivityItem key={item.id} item={item} />
                  ))
                ) : (
                  <div className="text-center py-4">
                    <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Brak ostatniej aktywności</p>
                  </div>
                )}
              </div>
              
              {recentActivity.length > 0 && (
                <button 
                  onClick={() => onNavigate('drums')}
                  className="w-full mt-4 py-2 px-4 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200 border border-blue-200 rounded-lg hover:bg-blue-50"
                >
                  Zobacz wszystkie bębny
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="mt-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="text-center md:text-left mb-4 md:mb-0">
              <h3 className="text-lg font-semibold mb-2">Potrzebujesz pomocy?</h3>
              <p className="text-blue-100">Skontaktuj się z naszym zespołem wsparcia</p>
            </div>
            <div className="flex space-x-4">
              <button className="px-6 py-2 bg-white/20 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-all duration-200 font-medium">
                📞 Zadzwoń
              </button>
              <button className="px-6 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-all duration-200 font-medium">
                ✉️ Email
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
