import React from 'react';
import { ArrowRight, ChevronRight, User, Zap, Briefcase, TrendingUp, Flame } from 'lucide-react';
import UserProfileCard from '../components/common/UserProfileCard';
import { useAppStore } from '../store';

interface DashboardScreenProps {
  onNavigateToPortfolio?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigateToPortfolio }) => {
  const setActiveView = useAppStore((state) => state.setActiveView);

  const handleNavigatePositions = () => {
    if (onNavigateToPortfolio) {
      onNavigateToPortfolio();
    } else {
      setActiveView('positions');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 font-sans">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider text-white">
            Algorithmic Trading Workspace
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold mt-3">
            Welcome to Angel One SmartAPI Trading Console
          </h2>
          <p className="mt-2 text-sm text-blue-100 max-w-xl">
            Monitor real-time market positions, manage live strategy orders, and track your equity portfolio seamlessly.
          </p>
        </div>

        <button
          onClick={handleNavigatePositions}
          className="px-6 py-3 bg-white text-blue-600 hover:bg-blue-50 font-bold text-sm rounded-2xl shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center space-x-2 flex-shrink-0"
        >
          <span>View Portfolio Positions</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grid: Quick Actions & Profile Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* User Profile Overview */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <span>Connected User Account</span>
          </h3>
          <UserProfileCard />
        </div>

        {/* Quick Links Card */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <span>Direct Navigation & Features</span>
          </h3>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-6 shadow-sm space-y-4">
            <div
              onClick={handleNavigatePositions}
              className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Portfolio Positions & Holdings
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Track open positions, P&L, M2M, and delivery holdings
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </div>
            </div>

            <div
              onClick={() => setActiveView('fno')}
              className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-gray-200 dark:border-gray-700 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        Top Volatile F&O Movers
                      </h4>
                      <span className="text-[10px] px-2 py-0.2 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold rounded-full">
                        Live
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Futures, Call (CE) & Put (PE) high-swing derivatives
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </div>
            </div>

            <div
              onClick={() => setActiveView('markets')}
              className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border border-gray-200 dark:border-gray-700 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      Live Markets & Indices
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Track Nifty, Sensex & BankNifty live market streams
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardScreen;
